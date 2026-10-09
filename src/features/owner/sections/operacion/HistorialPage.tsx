import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingFn,
} from '@tanstack/react-table';
import { DataTable } from '../../../../features/data-table';
import { VehicleCell } from '../../../../features/data-table/components/VehicleCell';
import { PlateCell } from '../../../../features/data-table/components/PlateCell';
import {
  formatStayDuration,
  StayDateCell,
  TableDateTimeCell,
} from '../../../../features/data-table/components/StayDateCell';
import { dateTimeSorting } from '../../../../features/data-table/utils';
import { getDateRangeExcelFileName } from '../../../../features/data-table/excelExport';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { Modal } from '../../../../shared/components/ui/Modal';
import { Switch } from '../../../../shared/components/ui/Switch';
import {
  IconAlert,
  IconChevronLeft,
  IconEye,
  IconRefresh,
} from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import { useArcaAccount } from '../../hooks/useArcaAccount';
import type { ArcaTaxCondition } from '../../services/arca';
import { listPaymentMethods } from '../../services/entities';
import { listAllCashSessions } from '../../services/cash-sessions';
import {
  issueInvoiceBatch,
  listInvoices,
  type InvoiceBatchResult,
} from '../../services/invoices';
import {
  getLprDetectionEventImageUrl,
  listRegisteredLprDetectionEventsForEntries,
} from '../../services/lpr-events';
import {
  listEntries,
  listPaymentTransactions,
} from '../../services/operations';
import { plateOverlayStyle } from '../auditoria/lprImage';
import { InvoiceBatchResultModal } from './InvoiceBatchResultModal';
import { InvoiceDetail, type ArcaInvoicing } from './InvoiceDetail';
import {
  canIssueInvoice,
  formatExternalInvoice,
  INVOICE_STATE_LABEL,
  INVOICE_STATE_ORDER,
  INVOICE_STATE_VARIANT,
  invoiceLetter,
  voucherLabel,
} from './invoiceUtils';
import type { EntryHistoryRow } from './operationUtils';
import {
  attachPaymentsToEntries,
  cashSessionLabel,
  filterEntryHistoryRows,
  paymentMethodFilterOptions,
} from './operationUtils';
import './operation.css';

const SEARCHABLE_KEYS = [
  'ticketNumber',
  'plate',
  'vehicleBrand',
  'vehicleModel',
  'color',
  'invoiceReceiver',
  'notes',
];
const FILTERABLE_COLUMNS = [
  'enteredAtLocalDate',
  'leftAtLocalDate',
  'cashSessionId',
  'paymentMethodValues',
  'invoiceState',
  'invoiceLetterValue',
  'invoiceReceiver',
  'rateSnapshotName',
  'vehicleBrand',
  'vehicleModel',
  'color',
];
/** El receptor puede mostrarse; el comprobante queda solo como filtro. */
const INITIAL_COLUMN_VISIBILITY = {
  invoiceLetterValue: false,
  invoiceReceiver: false,
};
const INVOICE_STATE_OPTIONS = INVOICE_STATE_ORDER.map((state) => ({
  value: state,
  label: INVOICE_STATE_LABEL[state],
}));
const INVOICE_LETTER_OPTIONS = (['A', 'B', 'C'] as const).map((letter) => ({
  value: letter,
  label: `Factura ${letter}`,
}));
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
  const invoice =
    row.invoice &&
    (row.invoiceState === 'issued' || row.invoiceState === 'issuing')
      ? row.invoice
      : null;
  const letter = invoiceLetter(invoice?.cbteTipo);
  const voucherNumber =
    invoice?.ptoVta != null && invoice.cbteNro != null
      ? `${String(invoice.ptoVta).padStart(4, '0')}-${String(invoice.cbteNro).padStart(8, '0')}`
      : null;
  const voucher = invoice ? voucherLabel(invoice) : null;
  return (
    <div className="operation-invoice-cell">
      <Badge variant={INVOICE_STATE_VARIANT[row.invoiceState]}>
        {INVOICE_STATE_LABEL[row.invoiceState]}
      </Badge>
      {letter ? (
        <span className="operation-invoice-line">Factura {letter}</span>
      ) : voucher ? (
        <span className="operation-invoice-line">{voucher}</span>
      ) : null}
      {voucherNumber ? (
        <span className="operation-invoice-number">{voucherNumber}</span>
      ) : null}
      {row.invoiceState === 'manual' && row.manualInvoiceNumber ? (
        <span className="operation-invoice-number">
          {formatExternalInvoice(row)}
        </span>
      ) : null}
    </div>
  );
}

function paidLabel(row: EntryHistoryRow): string {
  return row.paidTotal != null ? fmtMoney(row.paidTotal) : 'Sin cobro';
}

function invoiceExportValue(row: EntryHistoryRow): string {
  if (row.invoiceState === 'na') return '';
  const invoice =
    row.invoiceState === 'issued' || row.invoiceState === 'issuing'
      ? row.invoice
      : null;
  const letter = invoiceLetter(invoice?.cbteTipo);
  const number =
    invoice?.ptoVta != null && invoice.cbteNro != null
      ? `${String(invoice.ptoVta).padStart(4, '0')}-${String(invoice.cbteNro).padStart(8, '0')}`
      : null;
  return [
    INVOICE_STATE_LABEL[row.invoiceState],
    row.invoiceState === 'manual' && row.manualInvoiceNumber
      ? formatExternalInvoice(row)
      : null,
    letter ? `Factura ${letter}` : invoice ? voucherLabel(invoice) : null,
    number,
  ]
    .filter(Boolean)
    .join('\n');
}

function compactPaymentMethods(row: EntryHistoryRow): string {
  if (row.paymentLines.length === 0) return 'Sin medio';
  return row.paymentLines.map((line) => line.paymentMethodName).join(' + ');
}

function PaymentSummary({ row }: { row: EntryHistoryRow }) {
  if (row.paidTotal == null) return <MutedDash />;
  const methods = compactPaymentMethods(row);
  const breakdown =
    row.paymentLines.length > 1
      ? row.paymentLines
          .map((line) => `${line.paymentMethodName}: ${fmtMoney(line.amount)}`)
          .join(' · ')
      : methods;

  return (
    <div className="operation-payment-summary" title={breakdown}>
      <strong>{fmtMoney(row.paidTotal)}</strong>
      <span>{methods}</span>
    </div>
  );
}

function PaymentLines({ row }: { row: EntryHistoryRow }) {
  if (row.paymentLines.length === 0) {
    return row.paidTotal != null ? (
      <span className="operation-mono">{fmtMoney(row.paidTotal)}</span>
    ) : (
      <MutedDash />
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

function HistoryPhotoModal({
  row,
  tenantId,
  onClose,
}: {
  row: EntryHistoryRow | null;
  tenantId: string;
  onClose: () => void;
}) {
  const signedUrlQuery = useQuery({
    queryKey: [
      'history-entry-lpr-image-url',
      tenantId,
      row?.lprDetection?.id,
      row?.lprDetection?.imageStoragePath,
    ],
    queryFn: () =>
      getLprDetectionEventImageUrl({
        tenantId,
        eventId: row?.lprDetection?.id ?? '',
      }),
    enabled: Boolean(
      row && !row.historyImageUrl && row.lprDetection?.imageStoragePath,
    ),
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });

  const imageUrl = row?.historyImageUrl ?? signedUrlQuery.data ?? null;
  const bbox = row?.lprDetection?.plateBbox ?? null;

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title={row ? `Foto de ${row.plate}` : 'Foto del ingreso'}
      width={960}
      fitContent
      bodyScrollable={false}
      bodyStyle={{ overflow: 'hidden' }}
    >
      {!row || signedUrlQuery.isLoading ? (
        <div className="operation-photo-state">Cargando imagen...</div>
      ) : signedUrlQuery.isError || !imageUrl ? (
        <div className="operation-photo-state">
          <IconAlert size={22} />
          No se pudo cargar la imagen.
        </div>
      ) : (
        <div className="operation-photo-frame">
          <div className="operation-photo-stage">
            <img src={imageUrl} alt={`Vehículo ${row.plate}`} />
            {bbox ? (
              <span
                className="operation-photo-plate"
                style={plateOverlayStyle(bbox)}
              />
            ) : null}
          </div>
        </div>
      )}
    </Modal>
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
  paymentModeAllowed,
  onInvoiceChanged,
  onClose,
}: {
  row: EntryHistoryRow | null;
  cashSessionName: string | null;
  tenantId: string;
  arca: ArcaInvoicing;
  emitter: ArcaTaxCondition | null;
  paymentModeAllowed: boolean;
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
            <DetailItem label="Ticket">
              {row.ticketNumber ?? <MutedDash />}
            </DetailItem>
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
              paymentModeAllowed={paymentModeAllowed}
              onChanged={onInvoiceChanged}
            />
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function HistorialPage({
  cashSessionId,
  renderTable,
}: {
  cashSessionId?: string;
  renderTable?: (table: ReactNode, nestedDialogOpen: boolean) => ReactNode;
} = {}) {
  const { sucursalId, sucursal } = useSucursal();
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as HistorialLocationState;
  const [searchParams] = useSearchParams();
  const focusedCashSessionId =
    cashSessionId ?? searchParams.get('cashSessionId');
  const openedFromCaja =
    searchParams.get('from') === 'caja' || Boolean(locationState?.fromCaja);
  const [onlyCurrentSession, setOnlyCurrentSession] = useState(
    () => !focusedCashSessionId,
  );
  const [includeInLot, setIncludeInLot] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoRow, setPhotoRow] = useState<EntryHistoryRow | null>(null);
  const [visibleEntryIds, setVisibleEntryIds] = useState<string[]>([]);
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
  const [columnFiltersOverrideKey, setColumnFiltersOverrideKey] =
    useState<number>();

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
  const paymentMethodsQuery = useQuery({
    queryKey: ['owner-operations', sucursalId, 'payment-methods'],
    queryFn: () => listPaymentMethods(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const invoicesQuery = useQuery({
    queryKey: ['owner-operations', sucursalId, 'invoices'],
    queryFn: () => listInvoices(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const lprEventsQuery = useQuery({
    queryKey: [
      'owner-operations',
      sucursalId,
      'registered-lpr-events',
      visibleEntryIds,
    ],
    queryFn: () =>
      listRegisteredLprDetectionEventsForEntries({
        tenantId: sucursalId,
        entryIds: visibleEntryIds,
      }),
    enabled: Boolean(sucursalId && visibleEntryIds.length > 0),
    staleTime: 60 * 1000,
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

  const sessionOpenedAtById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session.openedAt])),
    [sessions],
  );

  const baseRows = useMemo(
    () =>
      attachPaymentsToEntries(
        entriesQuery.data ?? [],
        paymentsQuery.data ?? [],
        invoicesQuery.data ?? [],
        lprEventsQuery.data ?? [],
      ),
    [
      entriesQuery.data,
      paymentsQuery.data,
      invoicesQuery.data,
      lprEventsQuery.data,
    ],
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
  const rows = switchedRows;
  const selected = useMemo(
    () => baseRows.find((row) => row.id === selectedId) ?? null,
    [baseRows, selectedId],
  );
  const plateByEntryId = useMemo(
    () => new Map(baseRows.map((row) => [row.id, row.plate])),
    [baseRows],
  );
  const invoiceModeByMethodId = useMemo(
    () =>
      new Map(
        (paymentMethodsQuery.data ?? []).map((method) => [
          method.id,
          method.invoiceMode,
        ]),
      ),
    [paymentMethodsQuery.data],
  );
  const issuableIds = useMemo(
    () =>
      new Set(
        baseRows
          .filter(
            (row) =>
              canIssueInvoice(row.invoiceState, arca !== 'none') &&
              row.paymentLines.length > 0 &&
              row.paymentLines.every((line) => {
                const mode = line.paymentMethodId
                  ? invoiceModeByMethodId.get(line.paymentMethodId)
                  : undefined;
                return mode !== undefined && mode !== 'none';
              }),
          )
          .map((row) => row.id),
      ),
    [arca, baseRows, invoiceModeByMethodId],
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
  const handleVisibleRowIdsChange = useCallback((ids: string[]) => {
    setVisibleEntryIds((current) => {
      if (
        current.length === ids.length &&
        current.every((id, index) => id === ids[index])
      ) {
        return current;
      }
      return ids;
    });
  }, []);

  const columns = useMemo<ColumnDef<EntryHistoryRow, unknown>[]>(
    () => [
      {
        id: 'photo',
        meta: {
          excludeFromExport: true,
        },
        header: '',
        size: 44,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const hasPhoto = Boolean(
            row.original.historyImageUrl ||
            row.original.lprDetection?.imageStoragePath,
          );
          return (
            <button
              type="button"
              className="operation-photo-button"
              disabled={!hasPhoto}
              title={
                hasPhoto
                  ? `Ver foto de ${row.original.plate}`
                  : 'Este ingreso no tiene foto'
              }
              aria-label={
                hasPhoto
                  ? `Ver foto de ${row.original.plate}`
                  : 'Este ingreso no tiene foto'
              }
              onClick={(event) => {
                event.stopPropagation();
                if (hasPhoto) setPhotoRow(row.original);
              }}
            >
              <IconEye size={16} />
            </button>
          );
        },
      },
      {
        accessorKey: 'ticketNumber',
        header: '#',
        size: 64,
        cell: ({ row }) =>
          row.original.ticketNumber != null ? (
            <span className="operation-ticket-badge">
              #{row.original.ticketNumber}
            </span>
          ) : (
            <MutedDash />
          ),
      },
      {
        accessorKey: 'plate',
        header: 'Patente',
        size: 120,
        cell: ({ row }) => <PlateCell plate={row.original.plate} />,
      },
      {
        id: 'vehicle',
        accessorFn: (row) =>
          [row.vehicleBrand, row.vehicleModel, row.color]
            .filter(Boolean)
            .join(' '),
        header: 'Vehículo',
        size: 165,
        meta: {
          exportValue: (row) =>
            [row.vehicleBrand, row.vehicleModel, row.color]
              .filter(Boolean)
              .join('\n'),
        },
        cell: ({ row }) => (
          <VehicleCell
            brand={row.original.vehicleBrand}
            model={row.original.vehicleModel}
            color={row.original.color}
          />
        ),
      },
      {
        accessorKey: 'vehicleBrand',
        header: 'Marca',
        enableHiding: false,
        meta: { filterOnly: true, displayColumnId: 'vehicle' },
      },
      {
        accessorKey: 'vehicleModel',
        header: 'Modelo',
        enableHiding: false,
        meta: { filterOnly: true, displayColumnId: 'vehicle' },
      },
      {
        id: 'enteredAtLocalDate',
        accessorKey: 'enteredAtLocalDate',
        header: 'Ingreso',
        meta: {
          exportValue: (row) =>
            `${fmtDateTimeAr(row.enteredAt)}\n${row.leftAt ? '' : 'En curso · '}${formatStayDuration(row.enteredAt, row.leftAt)}`,
        },
        size: 180,
        filterFn: 'dateRange',
        sortingFn: dateTimeSorting((row) => row.enteredAt),
        cell: ({ row }) => (
          <StayDateCell
            enteredAt={row.original.enteredAt}
            leftAt={row.original.leftAt}
          />
        ),
      },
      {
        id: 'leftAtLocalDate',
        accessorKey: 'leftAtLocalDate',
        header: 'Egreso',
        meta: {
          exportValue: (row) =>
            row.leftAt ? fmtDateTimeAr(row.leftAt) : 'En base',
        },
        size: 160,
        filterFn: 'dateRange',
        sortingFn: dateTimeSorting((row) => row.leftAt),
        cell: ({ row }) =>
          row.original.leftAt ? (
            <TableDateTimeCell value={row.original.leftAt} />
          ) : (
            <Badge>En base</Badge>
          ),
      },
      {
        id: 'paymentMethodValues',
        accessorKey: 'paymentMethodValues',
        header: 'Cobrado',
        size: 155,
        filterFn: 'includesSome',
        sortingFn: moneySorting,
        meta: {
          filterLabel: 'Medio de pago',
          exportValue: (row) =>
            row.paidTotal == null
              ? ''
              : `${fmtMoney(row.paidTotal)}\n${compactPaymentMethods(row)}`,
        },
        cell: ({ row }) => <PaymentSummary row={row.original} />,
      },
      {
        id: 'invoiceState',
        accessorKey: 'invoiceState',
        header: 'Factura',
        meta: { exportValue: invoiceExportValue },
        size: 190,
        filterFn: 'includesSome',
        cell: ({ row }) => <InvoiceCell row={row.original} />,
      },
      {
        id: 'invoiceLetterValue',
        accessorKey: 'invoiceLetterValue',
        header: 'Comprobante',
        enableHiding: false,
        meta: { filterOnly: true },
        filterFn: 'includesSome',
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
        id: 'cashSessionId',
        accessorFn: (row) => row.cashSessionId ?? '',
        header: 'Caja',
        meta: {
          exportValue: (row) =>
            row.cashSessionId
              ? (sessionLabelById.get(row.cashSessionId) ??
                row.cashSessionId.slice(0, 8))
              : '',
        },
        size: 190,
        filterFn: 'includesSome',
        sortingFn: dateTimeSorting((row) =>
          sessionOpenedAtById.get(row.cashSessionId ?? ''),
        ),
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
        accessorKey: 'rateSnapshotName',
        header: 'Tarifa',
        size: 150,
        cell: ({ row }) => row.original.rateSnapshotName || <MutedDash />,
      },
      {
        accessorKey: 'color',
        header: 'Color',
        enableHiding: false,
        meta: { filterOnly: true, displayColumnId: 'vehicle' },
      },
      {
        accessorKey: 'notes',
        header: 'Notas',
        size: 240,
        cell: ({ row }) => row.original.notes || <MutedDash />,
      },
      {
        accessorKey: 'cochera',
        header: 'Cochera',
        size: 110,
        cell: ({ row }) => row.original.cochera || <MutedDash />,
      },
    ],
    [sessionLabelById, sessionOpenedAtById],
  );

  const isLoading =
    entriesQuery.isLoading ||
    sessionsQuery.isLoading ||
    paymentsQuery.isLoading ||
    paymentMethodsQuery.isLoading ||
    invoicesQuery.isLoading;
  const isError =
    entriesQuery.isError ||
    sessionsQuery.isError ||
    paymentsQuery.isError ||
    paymentMethodsQuery.isError ||
    invoicesQuery.isError;

  function refreshAll() {
    void entriesQuery.refetch();
    void sessionsQuery.refetch();
    void paymentsQuery.refetch();
    void paymentMethodsQuery.refetch();
    void invoicesQuery.refetch();
    void lprEventsQuery.refetch();
  }

  /** Después de emitir o marcar: facturas y estadías (por la `version`). */
  const refreshInvoicing = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['owner-operations', sucursalId, 'invoices'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['owner-operations', sucursalId, 'entries'],
      }),
    ]);
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
      void refreshInvoicing();
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
    setColumnFiltersOverrideKey((current) => (current ?? 0) + 1);
  }

  const renderContent = renderTable ?? ((content: ReactNode) => content);
  return (
    <div className="operation-page">
      {!renderTable ? (
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
      ) : null}

      {renderContent(
        isError ? (
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
            <DataTable<EntryHistoryRow>
              excelExport={{
                fileName: (rows) =>
                  getDateRangeExcelFileName(rows.map((row) => row.enteredAt)),
                onError: (error) =>
                  showToast({
                    message: translateApiError(error),
                    kind: 'error',
                  }),
              }}
              key={focusedCashSessionId ?? 'historial'}
              data={rows}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No hay movimientos registrados todavía."
              searchPlaceholder="Buscar por ticket, patente, vehículo o notas"
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
              initialColumnFiltersOverridePersistedState={Boolean(
                focusedCashSessionId,
              )}
              onColumnFiltersChange={handleColumnFiltersChange}
              onVisibleRowIdsChange={handleVisibleRowIdsChange}
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
                invoicesQuery.isFetching ||
                lprEventsQuery.isFetching
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
                  ? {
                      userId,
                      tenantId: sucursalId,
                      tableKey: renderTable
                        ? 'owner-cash-session-movements'
                        : 'owner-history',
                    }
                  : undefined
              }
            />
          </>
        ),
        Boolean(selectedId || photoRow || batchResults),
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
        paymentModeAllowed={selected ? issuableIds.has(selected.id) : false}
        onInvoiceChanged={() => void refreshInvoicing()}
        onClose={() => setSelectedId(null)}
      />

      <HistoryPhotoModal
        row={photoRow}
        tenantId={sucursalId}
        onClose={() => setPhotoRow(null)}
      />

      <InvoiceBatchResultModal
        results={batchResults}
        plateByEntryId={plateByEntryId}
        onClose={() => setBatchResults(null)}
      />
    </div>
  );
}
