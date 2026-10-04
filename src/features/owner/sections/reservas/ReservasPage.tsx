import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../../data-table';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { Tabs } from '../../../../shared/components/ui/Tabs';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import {
  IconAlert,
  IconCalendar,
  IconSettings,
} from '../../../../shared/components/icons';
import { fmtMoney0 } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import { useMetricsSummary } from '../../hooks/useMetrics';
import {
  useNow,
  useReservationActions,
  useReservationDetail,
  useReservationService,
  useReservationsBoard,
  useTodayReservations,
} from '../../hooks/useReservations';
import type { OwnerReservation } from '../../services/reservations';
import { Countdown } from './Countdown';
import { ReasonDialog } from './ReasonDialog';
import { ReservationDrawer } from './ReservationDrawer';
import {
  availableActions,
  countByTab,
  countdownTo,
  explainRefundFailure,
  formatSlot,
  reasonLabel,
  refundChip,
  statusChip,
  tabOf,
  type ReservationAction,
  type ReservationTab,
} from './reservationUtils';

/** Relativo a la sección: resuelve igual bajo `/app` y `/ops/estacionamientos/:id`. */
const RESERVATIONS_SETTINGS_PATH = '../config/servicios#reservas';

const EMPTY_COPY: Record<
  ReservationTab,
  { title: string; description: string }
> = {
  pending: {
    title: 'No hay reservas por aceptar',
    description:
      'Cuando un conductor pague una reserva, la vas a ver acá para aceptarla o rechazarla.',
  },
  upcoming: {
    title: 'No hay reservas próximas',
    description:
      'Las reservas confirmadas que todavía no empezaron aparecen acá.',
  },
  inProgress: {
    title: 'No hay reservas en curso',
    description: 'Las reservas cuyo vehículo ya ingresó aparecen acá.',
  },
  history: {
    title: 'Todavía no hay reservas en el historial',
    description: 'Las completadas, canceladas y rechazadas quedan acá.',
  },
};

const SEARCHABLE_KEYS = ['vehiclePlate', 'driverName', 'code'];

interface DialogState {
  kind: 'reject' | 'cancel';
  reservation: OwnerReservation;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="pk-card pk-card-pad"
      style={{ flex: '1 1 140px', minWidth: 0 }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          color: 'var(--text-3)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--text-1)',
          fontFamily: 'var(--mono)',
        }}
      >
        {value}
      </p>
      {hint ? (
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Reservas pagas del estacionamiento: aceptar, rechazar, cancelar y reintentar reembolsos. */
export function ReservasPage() {
  const { sucursalId } = useSucursal();
  const { showToast } = useToast();
  const board = useReservationsBoard(sucursalId);
  const today = useTodayReservations(sucursalId);
  const summary = useMetricsSummary();
  const actions = useReservationActions(sucursalId);

  const { acceptanceMode, enabled: reservationsEnabled } =
    useReservationService(sucursalId);

  const [tab, setTab] = useState<ReservationTab>('upcoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{
    id: string;
    action: ReservationAction;
  } | null>(null);

  const counts = useMemo(
    () => countByTab(board.reservations),
    [board.reservations],
  );
  // "Por aceptar" solo existe en modo manual. Si el dueño pasó a automático con
  // reservas todavía esperando, la pestaña queda visible hasta resolverlas.
  const showPendingTab = acceptanceMode === 'manual' || counts.pending > 0;

  // Cuenta regresiva: el reloj solo corre si hay reservas esperando.
  const now = useNow(counts.pending > 0 || selectedId !== null);
  // Las columnas solo dependen de la hora de a 10 s ("Hoy", plazo vencido): así
  // la tabla no se reconstruye cada segundo por culpa de las cuentas regresivas.
  const nowBucket = Math.floor(now / 10_000);

  // Si la pestaña activa desaparece (se resolvió la última por aceptar), vuelve a Próximas.
  useEffect(() => {
    if (tab === 'pending' && !showPendingTab) setTab('upcoming');
  }, [tab, showPendingTab]);

  // Con reservas por aceptar, se abre en esa pestaña la primera vez que se
  // conocen los datos de cada estacionamiento (también al cambiar de sucursal).
  const [pickedFor, setPickedFor] = useState<string | null>(null);
  useEffect(() => {
    if (pickedFor === sucursalId || board.isLoading) return;
    setPickedFor(sucursalId);
    setTab(counts.pending > 0 ? 'pending' : 'upcoming');
  }, [pickedFor, sucursalId, board.isLoading, counts.pending]);

  const rows = useMemo(
    () => board.reservations.filter((r) => tabOf(r) === tab),
    [board.reservations, tab],
  );
  // Por aceptar: la que vence antes, primero. Próximas: la que empieza antes.
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (tab === 'pending') {
      copy.sort((a, b) =>
        (a.approvalDeadlineAt ?? '').localeCompare(b.approvalDeadlineAt ?? ''),
      );
    } else if (tab === 'upcoming' || tab === 'inProgress') {
      copy.sort((a, b) => a.entryAt.localeCompare(b.entryAt));
    }
    return copy;
  }, [rows, tab]);

  const failed = useMemo(
    () => board.reservations.filter((r) => r.refundStatus === 'failed'),
    [board.reservations],
  );
  const pendingRows = useMemo(
    () => board.reservations.filter((r) => r.status === 'pending_approval'),
    [board.reservations],
  );
  const mostUrgent = useMemo(() => {
    const deadlines = pendingRows
      .map((r) => r.approvalDeadlineAt)
      .filter((d): d is string => d !== null)
      .sort();
    return deadlines[0] ?? null;
  }, [pendingRows]);

  const selected = board.reservations.find((r) => r.id === selectedId) ?? null;
  const detailQuery = useReservationDetail(sucursalId, selectedId);

  function runAction(action: ReservationAction, r: OwnerReservation) {
    if (action === 'reject' || action === 'cancel') {
      setDialogError(null);
      setDialog({ kind: action, reservation: r });
      return;
    }
    setBusy({ id: r.id, action });
    const done = () => setBusy(null);
    if (action === 'accept') {
      actions.accept.mutate(r.id, {
        onSuccess: () =>
          showToast({
            message: `Aceptaste la reserva de ${r.vehiclePlate}. Pasó a Próximas.`,
            kind: 'success',
          }),
        onError: (e) =>
          showToast({ message: translateApiError(e), kind: 'error' }),
        onSettled: done,
      });
    } else {
      actions.retryRefund.mutate(r.id, {
        onSuccess: (updated) =>
          showToast({
            message:
              updated.refundStatus === 'failed'
                ? 'El reembolso volvió a fallar. Revisá el saldo de tu cuenta de Mercado Pago.'
                : 'Reintentamos el reembolso. En un momento se confirma.',
            kind: updated.refundStatus === 'failed' ? 'error' : 'success',
          }),
        onError: (e) =>
          showToast({ message: translateApiError(e), kind: 'error' }),
        onSettled: done,
      });
    }
  }

  function confirmDialog(reason: string) {
    if (!dialog) return;
    const { kind, reservation } = dialog;
    setBusy({ id: reservation.id, action: kind });
    const mutation = kind === 'reject' ? actions.reject : actions.cancel;
    mutation.mutate(
      { id: reservation.id, reason },
      {
        onSuccess: () => {
          setDialog(null);
          showToast({
            message:
              kind === 'reject'
                ? `Rechazaste la reserva de ${reservation.vehiclePlate}. Se reembolsa al conductor.`
                : `Cancelaste la reserva de ${reservation.vehiclePlate}. Se reembolsa al conductor.`,
            kind: 'success',
          });
        },
        onError: (e) => setDialogError(translateApiError(e)),
        onSettled: () => setBusy(null),
      },
    );
  }

  const columns = useMemo<ColumnDef<OwnerReservation, unknown>[]>(() => {
    const cols: ColumnDef<OwnerReservation, unknown>[] = [
      {
        accessorKey: 'vehiclePlate',
        header: 'Patente',
        size: 130,
        cell: ({ row }) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontFamily: 'var(--mono)' }}>
              {row.original.vehiclePlate}
            </strong>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {row.original.code}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'driverName',
        header: 'Conductor',
        size: 150,
        cell: ({ row }) => row.original.driverName ?? '—',
      },
      {
        id: 'slot',
        accessorKey: 'entryAt',
        header: 'Franja',
        size: 190,
        cell: ({ row }) =>
          formatSlot(row.original.entryAt, row.original.exitAt, new Date(now)),
      },
      {
        accessorKey: 'totalArs',
        header: 'Monto',
        size: 110,
        cell: ({ row }) => fmtMoney0(row.original.totalArs),
      },
      {
        id: 'status',
        accessorFn: (r) => statusChip(r).label,
        header: 'Estado',
        size: 200,
        cell: ({ row }) => {
          const r = row.original;
          const chip = statusChip(r);
          const sub =
            r.status === 'pending_approval' ? (
              <Countdown deadlineAt={r.approvalDeadlineAt} />
            ) : reasonLabel(r) ? (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {reasonLabel(r)}
              </span>
            ) : null;
          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: 'flex-start',
              }}
            >
              <Badge variant={chip.variant}>{chip.label}</Badge>
              {sub}
            </div>
          );
        },
      },
      {
        id: 'refund',
        accessorFn: (r) => refundChip(r)?.label ?? '',
        header: 'Reembolso',
        size: 150,
        cell: ({ row }) => {
          const chip = refundChip(row.original);
          return chip ? (
            <Badge variant={chip.variant}>{chip.label}</Badge>
          ) : (
            <span style={{ color: 'var(--text-3)' }}>—</span>
          );
        },
      },
    ];
    if (tab === 'pending') {
      cols.push({
        id: 'actions',
        header: 'Acciones',
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          const available = availableActions(r, now);
          const rowBusy = busy?.id === r.id ? busy.action : null;
          return (
            <div
              style={{ display: 'flex', gap: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              {available.includes('accept') ? (
                <Button
                  size="sm"
                  loading={rowBusy === 'accept'}
                  disabled={busy !== null}
                  onClick={() => runAction('accept', r)}
                >
                  Aceptar
                </Button>
              ) : null}
              {available.includes('reject') ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => runAction('reject', r)}
                >
                  Rechazar
                </Button>
              ) : null}
            </div>
          );
        },
      });
    } else {
      cols.push({
        id: 'actions',
        header: '',
        size: 120,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.refundStatus === 'failed' ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                loading={
                  busy?.id === row.original.id && busy.action === 'retryRefund'
                }
                disabled={busy !== null}
                onClick={() => runAction('retryRefund', row.original)}
              >
                Reintentar
              </Button>
            </div>
          ) : null,
      });
    }
    return cols;
    // `runAction` cierra sobre `actions` y `showToast`, estables en la práctica.
  }, [tab, nowBucket, busy]);

  const tabs = [
    ...(showPendingTab
      ? [{ id: 'pending', label: 'Por aceptar', count: counts.pending }]
      : []),
    { id: 'upcoming', label: 'Próximas', count: counts.upcoming },
    { id: 'inProgress', label: 'En curso', count: counts.inProgress },
    { id: 'history', label: 'Historial' },
  ];

  const todayCount = today.data?.length;
  const free = summary.data?.occupancy.free;

  const firstFailed = failed[0];
  const failedExplain = firstFailed
    ? explainRefundFailure(firstFailed.refundError, firstFailed.totalArs)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        title="Reservas"
        subtitle="Las reservas pagas de tus conductores: aceptalas, cancelalas y seguí los reembolsos."
        action={
          // Relativo: resuelve igual bajo /app y bajo /ops/estacionamientos.
          <Link
            to={RESERVATIONS_SETTINGS_PATH}
            className="pk-btn pk-btn-ghost pk-btn-icon"
            aria-label="Configurar reservas"
            title="Configurar reservas"
          >
            <IconSettings size={18} />
          </Link>
        }
      />

      {reservationsEnabled === false ? (
        <Alert
          variant="warn"
          icon={<IconAlert size={16} />}
          title="Las reservas están desactivadas."
          description="Activalas para que los conductores puedan reservar."
          action={
            <Link
              to={RESERVATIONS_SETTINGS_PATH}
              className="pk-btn pk-btn-primary pk-btn-sm"
            >
              Activar reservas
            </Link>
          }
        />
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi
          label="Hoy"
          value={todayCount === undefined ? '…' : String(todayCount)}
          hint="reservas con ingreso hoy"
        />
        <Kpi
          label="En curso"
          value={board.isLoading ? '…' : String(counts.inProgress)}
          hint="ya ingresaron"
        />
        <Kpi
          label="Libres ahora"
          value={free === null || free === undefined ? '…' : String(free)}
          hint="plazas sin vehículo"
        />
      </div>

      {failed.length > 0 && firstFailed && failedExplain ? (
        <Alert
          variant="err"
          icon={<IconAlert size={16} />}
          title={
            failed.length === 1
              ? '1 reembolso no se pudo hacer.'
              : `${failed.length} reembolsos no se pudieron hacer.`
          }
          description={`${failedExplain.title} ${failedExplain.action}`}
          action={
            failed.length === 1 ? (
              <Button
                size="sm"
                loading={
                  busy?.id === firstFailed.id && busy.action === 'retryRefund'
                }
                disabled={busy !== null}
                onClick={() => runAction('retryRefund', firstFailed)}
              >
                Reintentar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setSelectedId(firstFailed.id)}>
                Ver
              </Button>
            )
          }
        />
      ) : null}

      {counts.pending > 0 ? (
        <Alert
          variant="warn"
          title={
            counts.pending === 1
              ? 'Tenés 1 reserva por aceptar.'
              : `Tenés ${counts.pending} reservas por aceptar.`
          }
          description={
            mostUrgent && !countdownTo(mostUrgent, now)?.expired ? (
              <>
                Si no respondés a tiempo, se rechazan solas y se reembolsan.{' '}
                <Countdown
                  deadlineAt={mostUrgent}
                  prefix="La más urgente vence en "
                />
              </>
            ) : (
              'Si no respondés a tiempo, se rechazan solas y se reembolsan.'
            )
          }
          action={
            tab !== 'pending' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTab('pending')}
              >
                Ver
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {board.isError ? (
        <Alert
          variant="err"
          title="No pudimos cargar las reservas."
          description={translateApiError(board.error)}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void board.refetch()}
            >
              Reintentar
            </Button>
          }
        />
      ) : null}

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={(id) => setTab(id as ReservationTab)}
      />

      {board.isLoading ? (
        <Skeleton height={180} />
      ) : sortedRows.length === 0 ? (
        <EmptyState
          icon={<IconCalendar size={32} />}
          title={EMPTY_COPY[tab].title}
          description={EMPTY_COPY[tab].description}
        />
      ) : (
        <DataTable<OwnerReservation>
          key={tab}
          data={sortedRows}
          columns={columns}
          emptyMessage={EMPTY_COPY[tab].title}
          searchPlaceholder="Buscar por patente, conductor o código"
          searchableKeys={SEARCHABLE_KEYS}
          getRowId={(row) => row.id}
          initialPageSize={20}
          pageSizeOptions={[10, 20, 50, 100]}
          onRefresh={() => void board.refetch()}
          refreshDisabled={board.isFetching}
          onRowClick={(row) => setSelectedId(row.id)}
        />
      )}

      <ReservationDrawer
        reservation={selected}
        detail={detailQuery.data}
        now={now}
        busy={busy && busy.id === selectedId ? busy.action : null}
        onAction={runAction}
        onClose={() => setSelectedId(null)}
      />

      <ReasonDialog
        open={dialog !== null}
        kind={dialog?.kind ?? 'reject'}
        plate={dialog?.reservation.vehiclePlate ?? ''}
        refundArs={dialog?.reservation.totalArs ?? 0}
        loading={
          busy !== null && dialog !== null && busy.id === dialog.reservation.id
        }
        error={dialogError}
        onConfirm={confirmDialog}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
