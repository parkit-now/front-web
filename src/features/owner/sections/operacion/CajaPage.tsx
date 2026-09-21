import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../../../features/data-table';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Card } from '../../../../shared/components/ui/Card';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import {
  IconAlert,
  IconArrow,
  IconCar,
  IconClock,
  IconCreditCard,
  IconDollar,
  IconRefresh,
} from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import type { CashSession } from '../../services/cash-sessions';
import { listAllCashSessions } from '../../services/cash-sessions';
import {
  listEntries,
  listPaymentTransactions,
} from '../../services/operations';
import {
  cashSessionLabel,
  computeStatsBySession,
  type SessionStats,
} from './operationUtils';
import './operation.css';

type CashSessionRow = CashSession & {
  openedAtLocalDate: string;
  closedAtLocalDate: string;
  stats: SessionStats;
};

type CajaLocationState = {
  focusCashSessionId?: string;
} | null;

const FILTERABLE_COLUMNS = ['openedAtLocalDate', 'closedAtLocalDate'];

function MutedDash() {
  return <span className="operation-muted">—</span>;
}

function minutesLabel(minutes: number | null): string {
  if (minutes === null) return 'Sin datos';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  featured = false,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <Card
      className={`operation-metric ${featured ? 'operation-metric-featured' : ''}`}
    >
      <div className="operation-metric-top">
        {icon ? <span className="operation-metric-icon">{icon}</span> : null}
        <p className="operation-metric-label">{label}</p>
      </div>
      <p className="operation-metric-value">{value}</p>
      {subtitle ? (
        <p className="operation-metric-subtitle">{subtitle}</p>
      ) : null}
    </Card>
  );
}

function share(total: number, grandTotal: number): number {
  if (grandTotal <= 0) return 0;
  return Math.round((total / grandTotal) * 100);
}

function Breakdown({ stats }: { stats: SessionStats }) {
  if (stats.summary.byPm.length === 0) {
    return (
      <p className="operation-empty-inline">
        Todavía no hay cobros registrados.
      </p>
    );
  }

  return (
    <div className="operation-breakdown">
      {stats.summary.byPm.map((pm) => {
        const pct = share(pm.total, stats.summary.grandTotal);
        return (
          <div className="operation-breakdown-row" key={pm.pmId}>
            <div className="operation-breakdown-head">
              <span>{pm.pmName}</span>
              <strong>{fmtMoney(pm.total)}</strong>
            </div>
            <div className="operation-breakdown-track">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="operation-breakdown-foot">
              <span>{pm.count === 1 ? '1 cobro' : `${pm.count} cobros`}</span>
              <strong>{pct}%</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CashAudit({ stats }: { stats: SessionStats }) {
  return (
    <div className="operation-audit">
      <div className="operation-section-title">Arqueo de efectivo</div>
      <div className="operation-audit-box">
        <div className="operation-audit-row">
          <span>Fondo inicial</span>
          <strong>{fmtMoney(stats.summary.openingCash)}</strong>
        </div>
        <div className="operation-audit-row">
          <span>Cobrado en efectivo</span>
          <strong>+ {fmtMoney(stats.summary.cashCollected)}</strong>
        </div>
        <div className="operation-audit-row is-total">
          <span>Efectivo esperado</span>
          <strong>{fmtMoney(stats.summary.cashTotal)}</strong>
        </div>
        {stats.session.leavingCash != null ? (
          <>
            <div className="operation-audit-row">
              <span>Fondo siguiente</span>
              <strong>{fmtMoney(stats.session.leavingCash)}</strong>
            </div>
            <div className="operation-audit-row">
              <span>Efectivo retirado</span>
              <strong>
                {stats.withdrawnCash != null
                  ? fmtMoney(stats.withdrawnCash)
                  : '—'}
              </strong>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ActiveCashCard({
  stats,
  isLoading,
  onViewMovements,
}: {
  stats: SessionStats | null;
  isLoading: boolean;
  onViewMovements: (sessionId: string) => void;
}) {
  if (isLoading) {
    return (
      <Card className="operation-panel">
        <div className="operation-panel-head">
          <div>
            <h2 className="operation-panel-title">Caja activa</h2>
            <p className="operation-panel-subtitle">Cargando caja...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="operation-panel">
        <div className="operation-panel-head">
          <div>
            <h2 className="operation-panel-title">Sin caja activa</h2>
            <p className="operation-panel-subtitle">
              Cuando se abra una caja desde desktop aparecerá acá.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="operation-panel operation-cash-card">
      <div className="operation-panel-head">
        <div>
          <h2 className="operation-panel-title">Caja activa</h2>
          <p className="operation-panel-subtitle">
            Abierta: {fmtDateTimeAr(stats.session.openedAt)}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<IconArrow size={15} />}
          onClick={() => onViewMovements(stats.session.id)}
        >
          Ver movimientos
        </Button>
      </div>

      <div className="operation-hero-grid">
        <MetricCard
          label="Total recaudado"
          value={fmtMoney(stats.summary.grandTotal)}
          icon={<IconDollar size={15} />}
          featured
        />
        <MetricCard
          label="Efectivo en caja"
          value={fmtMoney(stats.summary.cashTotal)}
          icon={<IconCreditCard size={15} />}
        />
      </div>

      <div className="operation-grid">
        <MetricCard
          label="Vehículos"
          value={String(stats.vehicleCount)}
          subtitle={`${stats.vehiclesStillParked} en base`}
          icon={<IconCar size={15} />}
        />
        <MetricCard
          label="Ticket promedio"
          value={
            stats.averageTicket != null
              ? fmtMoney(stats.averageTicket)
              : 'Sin datos'
          }
          icon={<IconDollar size={15} />}
        />
        <MetricCard
          label="Estadía promedio"
          value={minutesLabel(stats.averageStayMinutes)}
          icon={<IconClock size={15} />}
        />
        <MetricCard
          label="Turno en curso"
          value={minutesLabel(stats.shiftDurationMinutes)}
          icon={<IconClock size={15} />}
        />
      </div>

      {stats.topRate ? (
        <p className="operation-top-rate">
          Tarifa más usada: <strong>{stats.topRate.name}</strong> (
          {stats.topRate.count})
        </p>
      ) : null}

      <div className="operation-section-title">Cobros por medio de pago</div>
      <Breakdown stats={stats} />
      <CashAudit stats={stats} />
    </Card>
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

function CashSessionDrawer({
  row,
  onClose,
  onViewMovements,
}: {
  row: CashSessionRow | null;
  onClose: () => void;
  onViewMovements: (sessionId: string) => void;
}) {
  return (
    <Drawer
      open={Boolean(row)}
      onClose={onClose}
      title="Detalle de caja"
      width={560}
    >
      {row ? (
        <div className="operation-drawer">
          <div className="operation-drawer-head">
            <div>
              <h2 className="operation-drawer-title">
                {cashSessionLabel(row)}
              </h2>
              <p className="operation-drawer-subtitle">
                {row.closedAt ? 'Caja cerrada' : 'Caja activa'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconArrow size={15} />}
              onClick={() => onViewMovements(row.id)}
            >
              Ver movimientos
            </Button>
          </div>

          <div className="operation-grid operation-drawer-metrics">
            <MetricCard
              label="Total recaudado"
              value={fmtMoney(row.stats.summary.grandTotal)}
              icon={<IconDollar size={15} />}
            />
            <MetricCard
              label="Efectivo en caja"
              value={fmtMoney(row.stats.summary.cashTotal)}
              icon={<IconCreditCard size={15} />}
            />
            <MetricCard
              label="Vehículos"
              value={String(row.stats.vehicleCount)}
              subtitle={`${row.stats.vehiclesStillParked} en base`}
              icon={<IconCar size={15} />}
            />
            <MetricCard
              label="Ticket promedio"
              value={
                row.stats.averageTicket != null
                  ? fmtMoney(row.stats.averageTicket)
                  : 'Sin datos'
              }
              icon={<IconDollar size={15} />}
            />
          </div>

          <div className="operation-detail-list">
            <DetailItem label="Apertura">
              {fmtDateTimeAr(row.openedAt)}
            </DetailItem>
            <DetailItem label="Cierre">
              {row.closedAt ? fmtDateTimeAr(row.closedAt) : 'Activa'}
            </DetailItem>
            <DetailItem label="Duración">
              {minutesLabel(row.stats.shiftDurationMinutes)}
            </DetailItem>
            <DetailItem label="Fondo inicial">
              {fmtMoney(row.openingCash)}
            </DetailItem>
            <DetailItem label="Fondo siguiente">
              {row.leavingCash != null ? (
                fmtMoney(row.leavingCash)
              ) : (
                <MutedDash />
              )}
            </DetailItem>
            <DetailItem label="Efectivo retirado">
              {row.stats.withdrawnCash != null ? (
                fmtMoney(row.stats.withdrawnCash)
              ) : (
                <MutedDash />
              )}
            </DetailItem>
            <DetailItem label="Tarifa más usada">
              {row.stats.topRate ? (
                `${row.stats.topRate.name} (${row.stats.topRate.count})`
              ) : (
                <MutedDash />
              )}
            </DetailItem>
            <DetailItem label="Notas">{row.notes || <MutedDash />}</DetailItem>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="operation-section-title">
              Cobros por medio de pago
            </div>
            <div style={{ marginTop: 10 }}>
              <Breakdown stats={row.stats} />
            </div>
          </div>

          <CashAudit stats={row.stats} />
        </div>
      ) : null}
    </Drawer>
  );
}

export function CajaPage() {
  const { sucursalId, sucursal } = useSucursal();
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CajaLocationState;
  const [selected, setSelected] = useState<CashSessionRow | null>(null);

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
  const statsBySession = useMemo(
    () =>
      computeStatsBySession(
        sessions,
        entriesQuery.data ?? [],
        paymentsQuery.data ?? [],
      ),
    [entriesQuery.data, paymentsQuery.data, sessions],
  );
  const rows = useMemo<CashSessionRow[]>(
    () =>
      sessions
        .filter((session) => Boolean(session.closedAt))
        .flatMap((session) => {
          const stats = statsBySession.get(session.id);
          if (!stats) return [];
          return [
            {
              ...session,
              openedAtLocalDate: session.openedAt.slice(0, 10),
              closedAtLocalDate: session.closedAt?.slice(0, 10) ?? '',
              stats,
            },
          ];
        }),
    [sessions, statsBySession],
  );
  const activeStats = useMemo(() => {
    const active = sessions.find((session) => !session.closedAt);
    return active ? (statsBySession.get(active.id) ?? null) : null;
  }, [sessions, statsBySession]);

  function historyPath(sessionId: string): string {
    const base = location.pathname.replace(/\/caja\/?$/, '/historial');
    return `${base}?cashSessionId=${encodeURIComponent(sessionId)}&from=caja`;
  }

  function viewMovements(sessionId: string) {
    setSelected(null);
    void navigate(historyPath(sessionId), {
      state: { fromCaja: true, cashSessionId: sessionId },
    });
  }

  const columns = useMemo<ColumnDef<CashSessionRow, unknown>[]>(
    () => [
      {
        id: 'openedAtLocalDate',
        accessorKey: 'openedAtLocalDate',
        header: 'Apertura',
        size: 160,
        filterFn: 'dateRange',
        cell: ({ row }) => fmtDateTimeAr(row.original.openedAt),
      },
      {
        id: 'closedAtLocalDate',
        accessorKey: 'closedAtLocalDate',
        header: 'Cierre',
        size: 160,
        filterFn: 'dateRange',
        cell: ({ row }) =>
          row.original.closedAt ? (
            fmtDateTimeAr(row.original.closedAt)
          ) : (
            <Badge>Activa</Badge>
          ),
      },
      {
        id: 'vehicleCount',
        header: 'Vehículos',
        size: 110,
        accessorFn: (row) => row.stats.vehicleCount,
      },
      {
        id: 'totalCollected',
        header: 'Total recaudado',
        size: 150,
        accessorFn: (row) => row.stats.summary.grandTotal,
        cell: ({ row }) => (
          <strong className="operation-mono">
            {fmtMoney(row.original.stats.summary.grandTotal)}
          </strong>
        ),
      },
      {
        id: 'cashInBox',
        header: 'Efectivo en caja',
        size: 150,
        accessorFn: (row) => row.stats.summary.cashTotal,
        cell: ({ row }) => fmtMoney(row.original.stats.summary.cashTotal),
      },
      {
        accessorKey: 'openingCash',
        header: 'Fondo inicial',
        size: 130,
        cell: ({ row }) => fmtMoney(row.original.openingCash),
      },
      {
        accessorKey: 'leavingCash',
        header: 'Fondo siguiente',
        size: 140,
        cell: ({ row }) =>
          row.original.leavingCash != null ? (
            fmtMoney(row.original.leavingCash)
          ) : (
            <MutedDash />
          ),
      },
      {
        accessorKey: 'notes',
        header: 'Notas',
        size: 220,
        cell: ({ row }) => row.original.notes || <MutedDash />,
      },
    ],
    [],
  );

  const isLoading =
    entriesQuery.isLoading ||
    sessionsQuery.isLoading ||
    paymentsQuery.isLoading;
  const isError =
    entriesQuery.isError || sessionsQuery.isError || paymentsQuery.isError;

  useEffect(() => {
    const focusCashSessionId = locationState?.focusCashSessionId;
    if (!focusCashSessionId || isLoading) return;
    const focused = rows.find((row) => row.id === focusCashSessionId);
    if (focused) setSelected(focused);
    void navigate(location.pathname, { replace: true, state: null });
  }, [
    isLoading,
    location.pathname,
    locationState?.focusCashSessionId,
    navigate,
    rows,
  ]);

  function refreshAll() {
    void entriesQuery.refetch();
    void sessionsQuery.refetch();
    void paymentsQuery.refetch();
  }

  return (
    <div className="operation-page">
      <SectionHeader
        title="Caja"
        subtitle={`Caja y arqueos de ${sucursal?.nombre ?? 'este estacionamiento'}`}
      />

      {isError ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconAlert size={28} />}
            title="No se pudo cargar caja"
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
          <ActiveCashCard
            stats={activeStats}
            isLoading={isLoading}
            onViewMovements={viewMovements}
          />

          <DataTable<CashSessionRow>
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No hay cajas cerradas registradas."
            searchPlaceholder="Buscar por notas"
            searchableKeys={['notes']}
            filterableColumns={FILTERABLE_COLUMNS}
            getRowId={(row) => row.id}
            initialPageSize={10}
            pageSizeOptions={[10, 20, 50, 100]}
            onRefresh={refreshAll}
            refreshDisabled={
              entriesQuery.isFetching ||
              sessionsQuery.isFetching ||
              paymentsQuery.isFetching
            }
            onRowClick={setSelected}
            templateScope={
              userId && sucursalId
                ? {
                    userId,
                    tenantId: sucursalId,
                    tableKey: 'owner-cash-sessions',
                  }
                : undefined
            }
          />
        </>
      )}

      <CashSessionDrawer
        row={selected}
        onClose={() => setSelected(null)}
        onViewMovements={viewMovements}
      />
    </div>
  );
}
