import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingFn,
} from '@tanstack/react-table';
import { DataTable } from '../../../../features/data-table';
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
import { listAllCashSessions } from '../../services/cash-sessions';
import {
  listEntries,
  listPaymentTransactions,
} from '../../services/operations';
import type { EntryHistoryRow } from './operationUtils';
import {
  attachPaymentsToEntries,
  cashSessionLabel,
  filterEntryHistoryRows,
  paymentMethodFilterOptions,
} from './operationUtils';
import './operation.css';

const SEARCHABLE_KEYS = ['plate', 'notes'];
const FILTERABLE_COLUMNS = [
  'enteredAtLocalDate',
  'leftAtLocalDate',
  'cashSessionId',
  'paymentMethodValues',
  'rateSnapshotName',
  'vehicleBrand',
  'vehicleModel',
  'color',
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
  onClose,
}: {
  row: EntryHistoryRow | null;
  cashSessionName: string | null;
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
  const [selected, setSelected] = useState<EntryHistoryRow | null>(null);
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
      ),
    [entriesQuery.data, paymentsQuery.data],
  );
  const rows = useMemo(
    () =>
      filterEntryHistoryRows(baseRows, {
        includeInLot,
        onlyCurrentSession,
        activeCashSessionId: activeCashSession?.id,
      }),
    [activeCashSession?.id, baseRows, includeInLot, onlyCurrentSession],
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
    paymentsQuery.isLoading;
  const isError =
    entriesQuery.isError || sessionsQuery.isError || paymentsQuery.isError;

  function refreshAll() {
    void entriesQuery.refetch();
    void sessionsQuery.refetch();
    void paymentsQuery.refetch();
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
        <DataTable<EntryHistoryRow>
          key={focusedCashSessionId ?? 'historial'}
          data={rows}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No hay movimientos registrados todavía."
          searchPlaceholder="Buscar por patente o notas"
          searchableKeys={SEARCHABLE_KEYS}
          filterableColumns={FILTERABLE_COLUMNS}
          filterOptionsByColumn={{
            cashSessionId: cashSessionOptions,
            paymentMethodValues: paymentOptions,
          }}
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
            paymentsQuery.isFetching
          }
          onRowClick={setSelected}
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
      )}

      <EntryDetailDrawer
        row={selected}
        cashSessionName={
          selected?.cashSessionId
            ? (sessionLabelById.get(selected.cashSessionId) ?? null)
            : null
        }
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
