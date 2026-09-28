import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingFn,
} from '@tanstack/react-table';
import { DataTable } from '../../../../features/data-table';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { Switch } from '../../../../shared/components/ui/Switch';
import {
  IconAlert,
  IconChevronLeft,
  IconRefresh,
} from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import { useArcaAccount } from '../../hooks/useArcaAccount';
import type { ArcaTaxCondition } from '../../services/arca';
import { listAllCashSessions } from '../../services/cash-sessions';
import {
  issueInvoiceBatch,
  listInvoices,
  type InvoiceBatchResult,
} from '../../services/invoices';
import {
  listEntries,
  listPaymentTransactions,
} from '../../services/operations';
import { InvoiceBatchResultModal } from './InvoiceBatchResultModal';
import { InvoiceDetail, type ArcaInvoicing } from './InvoiceDetail';
import {
  canIssueInvoice,
  countInvoiceChips,
  INVOICE_STATE_LABEL,
  INVOICE_STATE_ORDER,
  INVOICE_STATE_VARIANT,
  matchesInvoiceChip,
  voucherLabel,
  type InvoiceChip,
} from './invoiceUtils';
import type { EntryHistoryRow } from './operationUtils';
import {
  attachPaymentsToEntries,
  cashSessionLabel,
  filterEntryHistoryRows,
  paymentMethodFilterOptions,
} from './operationUtils';
import './operation.css';

const SEARCHABLE_KEYS = ['plate', 'vehicleBrand', 'vehicleModel', 'notes'];
const FILTERABLE_COLUMNS = [
  'enteredAtLocalDate',
  'leftAtLocalDate',
  'cashSessionId',
  'paymentMethodValues',
  'invoiceState',
  'invoiceLetterValue',
  'invoiceReceiver',
  'paidTotal',
  'rateSnapshotName',
  'vehicleBrand',
  'vehicleModel',
  'color',
];
/** Columnas que existen para filtrar pero arrancan ocultas. */
const INITIAL_COLUMN_VISIBILITY = {
  invoiceLetterValue: false,
  invoiceReceiver: false,
  paidTotal: false,
};
const INVOICE_STATE_OPTIONS = INVOICE_STATE_ORDER.map((state) => ({
  value: state,
  label: INVOICE_STATE_LABEL[state],
}));
const INVOICE_LETTER_OPTIONS = (['A', 'B', 'C'] as const).map((letter) => ({
  value: letter,
  label: `Factura ${letter}`,
}));
const INVOICE_CHIPS: ReadonlyArray<{ id: InvoiceChip; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'unbilled', label: 'Sin facturar' },
];

const moneySorting: SortingFn<EntryHistoryRow> = (left, right) => {
  return (left.original.paidTotal ?? -1) - (right.original.paidTotal ?? -1);
};

type HistorialLocationState = {
  fromCaja?: boolean;
  cashSessionId?: string;
} | null;

function MutedDash() {
  return <span className="operation-muted">—</span>;
}

function InvoiceCell({ row }: { row: EntryHistoryRow }) {
  if (row.invoiceState === 'na') return <MutedDash />;
  const voucher =
    row.invoice &&
    (row.invoiceState === 'issued' || row.invoiceState === 'issuing')
      ? voucherLabel(row.invoice)
      : null;
  return (
    <div className="operation-invoice-cell">
      <Badge variant={INVOICE_STATE_VARIANT[row.invoiceState]}>
        {INVOICE_STATE_LABEL[row.invoiceState]}
      </Badge>
      {voucher ? <small>{voucher}</small> : null}
    </div>
  );
}

function paidLabel(row: EntryHistoryRow): string {
  return row.paidTotal != null ? fmtMoney(row.paidTotal) : 'Sin cobro';
}

function PaymentLines({
  row,
  compact = false,
}: {
  row: EntryHistoryRow;
  compact?: boolean;
}) {
  if (row.paymentLines.length === 0) {
    return row.paidTotal != null ? (
      <span className="operation-mono">{fmtMoney(row.paidTotal)}</span>
    ) : (
      <MutedDash />
    );
  }

  if (compact) {
    return (
      <div className="operation-payment-table">
        {row.paymentLines.map((line) => (
          <div className="operation-payment-table-line" key={line.id}>
            <span>{line.paymentMethodName}</span>
            <strong>{fmtMoney(line.amount)}</strong>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="operation-payment-lines">
      {row.paymentLines.map((line) => (
        <div className="operation-breakdown-row" key={line.id}>
          <span>{line.paymentMethodName}</span>
          <strong>{fmtMoney(line.amount)}</strong>
        </div>
      ))}
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="operation-detail-item">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function EntryDetailDrawer({
  row,
  cashSessionName,
  tenantId,
  arca,
  emitter,
  onInvoiceChanged,
  onClose,
}: {
  row: EntryHistoryRow | null;
  cashSessionName: string | null;
  tenantId: string;
  arca: ArcaInvoicing;
  emitter: ArcaTaxCondition | null;
  onInvoiceChanged: () => void;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={Boolean(row)}
      onClose={onClose}
      title="Detalle de movimiento"
      width={540}
    >
      {row ? (
        <div className="operation-drawer">
          <h2 className="operation-drawer-title">{row.plate}</h2>
          <p className="operation-drawer-subtitle">
            {row.ticketNumber ? `Ticket ${row.ticketNumber}` : 'Sin ticket'}
          </p>

          <div className="operation-detail-list">
            <DetailItem label="Caja">
              {cashSessionName ?? <MutedDash />}
            </DetailItem>
            <DetailItem label="Ingreso">
              {fmtDateTimeAr(row.enteredAt)}
            </DetailItem>
            <DetailItem label="Egreso">
              {row.leftAt ? fmtDateTimeAr(row.leftAt) : 'Auto en base'}
            </DetailItem>
            <DetailItem label="Tarifa">
              {row.rateSnapshotName || <MutedDash />}
            </DetailItem>
            <DetailItem label="Cobrado">{paidLabel(row)}</DetailItem>
            <DetailItem label="Marca">
              {row.vehicleBrand || <MutedDash />}
            </DetailItem>
            <DetailItem label="Modelo">
              {row.vehicleModel || <MutedDash />}
            </DetailItem>
            <DetailItem label="Color">{row.color || <MutedDash />}</DetailItem>
            <DetailItem label="Cochera">
              {row.cochera || <MutedDash />}
            </DetailItem>
            <DetailItem label="Notas">{row.notes || <MutedDash />}</DetailItem>
          </div>

          <div style={{ marginTop: 22 }}>
            <h3 className="operation-panel-title" style={{ fontSize: 15 }}>
              Pagos
            </h3>
            <div style={{ marginTop: 10 }}>
              <PaymentLines row={row} />
            </div>
          </div>

          {row.invoiceState !== 'na' || row.invoice ? (
            <InvoiceDetail
              key={row.id}
              row={row}
              tenantId={tenantId}
              arca={arca}
              emitter={emitter}
              onChanged={onInvoiceChanged}
            />
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function HistorialPage() {
  const { sucursalId, sucursal } = useSucursal();
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as HistorialLocationState;
  const [searchParams] = useSearchParams();
  const focusedCashSessionId = searchParams.get('cashSessionId');
  const openedFromCaja =
    searchParams.get('from') === 'caja' || Boolean(locationState?.fromCaja);
  const [onlyCurrentSession, setOnlyCurrentSession] = useState(
    () => !focusedCashSessionId,
  );
  const [includeInLot, setIncludeInLot] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invoiceChip, setInvoiceChip] = useState<InvoiceChip>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<InvoiceBatchResult[] | null>(
    null,
  );
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const arcaQuery = useArcaAccount(sucursalId);
  const arcaStatus = arcaQuery.data?.status;
  const arca: ArcaInvoicing =
    arcaStatus === 'linked' || arcaStatus === 'cert_expired'
      ? arcaStatus
      : 'none';
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnFiltersOverride, setColumnFiltersOverride] =
    useState<ColumnFiltersState>([]);
  const [columnFiltersOverrideKey, setColumnFiltersOverrideKey] = useState(0);

  const entriesQuery = useQuery({
    queryKey: ['owner-operations', sucursalId, 'entries'],
    queryFn: () => listEntries(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const sessionsQuery = useQuery({
    queryKey: ['owner-operations', sucursalId, 'cash-sessions'],
    queryFn: () => listAllCashSessions(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const paymentsQuery = useQuery({
    queryKey: ['owner-operations', sucursalId, 'payment-transactions'],
    queryFn: () => listPaymentTransactions(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const invoicesQuery = useQuery({
    queryKey: ['owner-operations', sucursalId, 'invoices'],
    queryFn: () => listInvoices(sucursalId),
    enabled: Boolean(sucursalId),
  });

  const sessions = useMemo(
    () =>
      [...(sessionsQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.openedAt).getTime() -
          new Date(left.openedAt).getTime(),
      ),
    [sessionsQuery.data],
  );
  const activeCashSession = useMemo(
    () => sessions.find((session) => !session.closedAt),
    [sessions],
  );

  useEffect(() => {
    if (!activeCashSession) setOnlyCurrentSession(false);
  }, [activeCashSession]);

  const sessionLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const session of sessions)
      labels.set(session.id, cashSessionLabel(session));
    return labels;
  }, [sessions]);

  const baseRows = useMemo(
    () =>
      attachPaymentsToEntries(
        entriesQuery.data ?? [],
        paymentsQuery.data ?? [],
        invoicesQuery.data ?? [],
      ),
    [entriesQuery.data, paymentsQuery.data, invoicesQuery.data],
  );
  const switchedRows = useMemo(
    () =>
      filterEntryHistoryRows(baseRows, {
        includeInLot,
        onlyCurrentSession,
        activeCashSessionId: activeCashSession?.id,
      }),
    [activeCashSession?.id, baseRows, includeInLot, onlyCurrentSession],
  );
  const chipCounts = useMemo(
    () => countInvoiceChips(switchedRows),
    [switchedRows],
  );
  const rows = useMemo(
    () =>
      invoiceChip === 'all'
        ? switchedRows
        : switchedRows.filter((row) =>
            matchesInvoiceChip(row.invoiceState, invoiceChip),
          ),
    [invoiceChip, switchedRows],
  );
  const selected = useMemo(
    () => baseRows.find((row) => row.id === selectedId) ?? null,
    [baseRows, selectedId],
  );
  const plateByEntryId = useMemo(
    () => new Map(baseRows.map((row) => [row.id, row.plate])),
    [baseRows],
  );
  const issuableIds = useMemo(
    () =>
      new Set(
        baseRows
          .filter((row) => canIssueInvoice(row.invoiceState, arca !== 'none'))
          .map((row) => row.id),
      ),
    [arca, baseRows],
  );
  // Lo elegido que ya no se puede emitir (se emitió, o cambió el filtro de
  // ARCA) sale solo de la selección.
  const selectedIssuable = useMemo(
    () => selectedIds.filter((id) => issuableIds.has(id)),
    [issuableIds, selectedIds],
  );

  const cashSessionOptions = useMemo(
    () =>
      sessions.map((session) => ({
        value: session.id,
        label: cashSessionLabel(session),
        includeWhenEmpty: true,
      })),
    [sessions],
  );
  const paymentOptions = useMemo(
    () => paymentMethodFilterOptions(paymentsQuery.data ?? []),
    [paymentsQuery.data],
  );
  const initialColumnFilters = useMemo<ColumnFiltersState>(
    () =>
      focusedCashSessionId
        ? [{ id: 'cashSessionId', value: [focusedCashSessionId] }]
        : [],
    [focusedCashSessionId],
  );

  const columns = useMemo<ColumnDef<EntryHistoryRow, unknown>[]>(
    () => [
      {
        id: 'cashSessionId',
        accessorFn: (row) => row.cashSessionId ?? '',
        header: 'Caja',
        size: 190,
        filterFn: 'includesSome',
        cell: ({ row }) => {
          const id = row.original.cashSessionId;
          return id ? (
            (sessionLabelById.get(id) ?? id.slice(0, 8))
          ) : (
            <MutedDash />
          );
        },
      },
      {
        accessorKey: 'plate',
        header: 'Patente',
        size: 110,
        cell: ({ row }) => (
          <strong className="operation-mono">{row.original.plate}</strong>
        ),
      },
      {
        accessorKey: 'vehicleBrand',
        header: 'Marca',
        size: 130,
        cell: ({ row }) => row.original.vehicleBrand || <MutedDash />,
      },
      {
        accessorKey: 'vehicleModel',
        header: 'Modelo',
        size: 140,
        cell: ({ row }) => row.original.vehicleModel || <MutedDash />,
      },
      {
        accessorKey: 'color',
        header: 'Color',
        size: 110,
        cell: ({ row }) => row.original.color || <MutedDash />,
      },
      {
        id: 'enteredAtLocalDate',
        accessorKey: 'enteredAtLocalDate',
        header: 'Ingreso',
        size: 160,
        filterFn: 'dateRange',
        cell: ({ row }) => fmtDateTimeAr(row.original.enteredAt),
      },
      {
        id: 'leftAtLocalDate',
        accessorKey: 'leftAtLocalDate',
        header: 'Egreso',
        size: 160,
        filterFn: 'dateRange',
        cell: ({ row }) =>
          row.original.leftAt ? (
            fmtDateTimeAr(row.original.leftAt)
          ) : (
            <Badge>En base</Badge>
          ),
      },
      {
        accessorKey: 'rateSnapshotName',
        header: 'Tarifa',
        size: 150,
        cell: ({ row }) => row.original.rateSnapshotName || <MutedDash />,
      },
      {
        id: 'paymentMethodValues',
        accessorKey: 'paymentMethodValues',
        header: 'Cobrado',
        size: 210,
        filterFn: 'includesSome',
        sortingFn: moneySorting,
        meta: { filterLabel: 'Medio de pago' },
        cell: ({ row }) => <PaymentLines row={row.original} compact />,
      },
      {
        id: 'invoiceState',
        accessorKey: 'invoiceState',
        header: 'Factura',
        size: 190,
        filterFn: 'includesSome',
        cell: ({ row }) => <InvoiceCell row={row.original} />,
      },
      {
        id: 'invoiceLetterValue',
        accessorKey: 'invoiceLetterValue',
        header: 'Comprobante',
        size: 120,
        filterFn: 'includesSome',
        cell: ({ row }) =>
          row.original.invoiceLetterValue ? (
            `Factura ${row.original.invoiceLetterValue}`
          ) : (
            <MutedDash />
          ),
      },
      {
        id: 'invoiceReceiver',
        accessorKey: 'invoiceReceiver',
        header: 'Receptor',
        size: 220,
        filterFn: 'includesSome',
        cell: ({ row }) => row.original.invoiceReceiver || <MutedDash />,
      },
      {
        id: 'paidTotal',
        accessorFn: (row) => row.paidTotal ?? undefined,
        header: 'Monto',
        size: 120,
        filterFn: 'numberRange',
        cell: ({ row }) =>
          row.original.paidTotal != null ? (
            <span className="operation-mono">
              {fmtMoney(row.original.paidTotal)}
            </span>
          ) : (
            <MutedDash />
          ),
      },
      {
        accessorKey: 'cochera',
        header: 'Cochera',
        size: 110,
        cell: ({ row }) => row.original.cochera || <MutedDash />,
      },
      {
        accessorKey: 'notes',
        header: 'Notas',
        size: 240,
        cell: ({ row }) => row.original.notes || <MutedDash />,
      },
    ],
    [sessionLabelById],
  );

  const isLoading =
    entriesQuery.isLoading ||
    sessionsQuery.isLoading ||
    paymentsQuery.isLoading ||
    invoicesQuery.isLoading;
  const isError =
    entriesQuery.isError ||
    sessionsQuery.isError ||
    paymentsQuery.isError ||
    invoicesQuery.isError;

  function refreshAll() {
    void entriesQuery.refetch();
    void sessionsQuery.refetch();
    void paymentsQuery.refetch();
    void invoicesQuery.refetch();
  }

  /** Después de emitir o marcar: facturas y estadías (por la `version`). */
  const refreshInvoicing = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['owner-operations', sucursalId, 'invoices'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['owner-operations', sucursalId, 'entries'],
    });
  }, [queryClient, sucursalId]);

  async function issueSelected() {
    // En el orden de la tabla (el más reciente primero), no en el de los clics.
    const ordered = rows
      .map((row) => row.id)
      .filter((id) => selectedIssuable.includes(id));
    const ids = [
      ...ordered,
      ...selectedIssuable.filter((id) => !ordered.includes(id)),
    ];
    if (ids.length === 0) return;
    setBatchRunning(true);
    try {
      setBatchResults(await issueInvoiceBatch(sucursalId, ids));
      setSelectedIds([]);
    } catch (error) {
      showToast({
        message: translateApiError(error, { endpoint: 'invoices.batch' }),
        kind: 'error',
      });
    } finally {
      setBatchRunning(false);
      refreshInvoicing();
    }
  }

  function backToCaja() {
    const cajaPath = location.pathname.replace(/\/historial\/?$/, '/caja');
    void navigate(cajaPath, {
      state: {
        focusCashSessionId:
          focusedCashSessionId ?? locationState?.cashSessionId,
      },
    });
  }

  const handleColumnFiltersChange = useCallback(
    (filters: ColumnFiltersState) => {
      setColumnFilters(filters);
      const cashSessionFilter = filters.find(
        (filter) => filter.id === 'cashSessionId',
      );
      const selectedCashSessionIds = Array.isArray(cashSessionFilter?.value)
        ? cashSessionFilter.value.map(String)
        : [];

      if (selectedCashSessionIds.length === 0) return;

      setOnlyCurrentSession(false);
    },
    [],
  );

  function handleOnlyCurrentSessionChange(next: boolean) {
    setOnlyCurrentSession(next);
    if (!next) return;

    setColumnFiltersOverride(
      columnFilters.filter((filter) => filter.id !== 'cashSessionId'),
    );
    setColumnFiltersOverrideKey((current) => current + 1);
  }

  return (
    <div className="operation-page">
      <SectionHeader
        title="Historial"
        subtitle={`Movimientos de ${sucursal?.nombre ?? 'este estacionamiento'}`}
        action={
          openedFromCaja ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<IconChevronLeft size={15} />}
              onClick={backToCaja}
            >
              Volver a Caja
            </Button>
          ) : undefined
        }
      />

      {isError ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconAlert size={28} />}
            title="No se pudo cargar el historial"
            description="Probá actualizar la sección."
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={<IconRefresh size={15} />}
                onClick={refreshAll}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div
            className="operation-invoice-chips"
            role="group"
            aria-label="Facturación"
          >
            {INVOICE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="operation-invoice-chip"
                aria-pressed={invoiceChip === chip.id}
                onClick={() => setInvoiceChip(chip.id)}
              >
                {chip.label}
                {chip.id === 'all' ? null : <b>{chipCounts[chip.id]}</b>}
              </button>
            ))}
          </div>
          <DataTable<EntryHistoryRow>
            key={focusedCashSessionId ?? 'historial'}
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No hay movimientos registrados todavía."
            searchPlaceholder="Buscar por patente, vehículo o notas"
            searchableKeys={SEARCHABLE_KEYS}
            filterableColumns={FILTERABLE_COLUMNS}
            filterOptionsByColumn={{
              cashSessionId: cashSessionOptions,
              paymentMethodValues: paymentOptions,
              invoiceState: INVOICE_STATE_OPTIONS,
              invoiceLetterValue: INVOICE_LETTER_OPTIONS,
            }}
            initialColumnVisibility={INITIAL_COLUMN_VISIBILITY}
            initialColumnFilters={initialColumnFilters}
            onColumnFiltersChange={handleColumnFiltersChange}
            columnFiltersOverride={columnFiltersOverride}
            columnFiltersOverrideKey={columnFiltersOverrideKey}
            getRowId={(row) => row.id}
            initialPageSize={20}
            pageSizeOptions={[10, 20, 50, 100]}
            onRefresh={refreshAll}
            refreshDisabled={
              entriesQuery.isFetching ||
              sessionsQuery.isFetching ||
              paymentsQuery.isFetching ||
              invoicesQuery.isFetching
            }
            onRowClick={(row) => setSelectedId(row.id)}
            rowSelection={
              arca === 'none'
                ? undefined
                : {
                    selectedIds: selectedIssuable,
                    onChange: setSelectedIds,
                    canSelect: (row) => issuableIds.has(row.id),
                    actions: (
                      <Button
                        size="sm"
                        loading={batchRunning}
                        disabled={selectedIssuable.length === 0}
                        onClick={() => void issueSelected()}
                      >
                        Emitir a consumidor final ({selectedIssuable.length})
                      </Button>
                    ),
                  }
            }
            toolbarLeading={
              <div className="dt-quick-switches">
                <label className="operation-quick-switch">
                  <Switch
                    checked={onlyCurrentSession}
                    disabled={!activeCashSession}
                    onChange={handleOnlyCurrentSessionChange}
                    aria-label="Solo caja actual"
                  />
                  Solo caja actual
                </label>
                <label className="operation-quick-switch">
                  <Switch
                    checked={includeInLot}
                    onChange={setIncludeInLot}
                    aria-label="Incluir autos en base"
                  />
                  Incluir autos en base
                </label>
              </div>
            }
            templateScope={
              userId && sucursalId
                ? { userId, tenantId: sucursalId, tableKey: 'owner-history' }
                : undefined
            }
          />
        </>
      )}

      <EntryDetailDrawer
        row={selected}
        cashSessionName={
          selected?.cashSessionId
            ? (sessionLabelById.get(selected.cashSessionId) ?? null)
            : null
        }
        tenantId={sucursalId}
        arca={arca}
        emitter={arcaQuery.data?.condicionIva ?? null}
        onInvoiceChanged={refreshInvoicing}
        onClose={() => setSelectedId(null)}
      />

      <InvoiceBatchResultModal
        results={batchResults}
        plateByEntryId={plateByEntryId}
        onClose={() => setBatchResults(null)}
      />
    </div>
  );
}
