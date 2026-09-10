import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { DataTable } from '../../../../features/data-table';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { IconAlert, IconRefresh } from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import {
  listAuditEvents,
  listCashSessions,
  type CashSession,
} from '../../services/audit';
import {
  buildAudit2Rows,
  correctionComparisons,
  metadataEntries,
  type Audit2Row,
} from './audit2Utils';

const FETCH_LIMIT = 500;
const AUDIT2_INITIAL_COLUMN_VISIBILITY = {
  cashSessionId: false,
  colors: false,
  enteredAtLocalDate: false,
  leftAtLocalDate: false,
  paymentMethodNames: false,
  rateNames: false,
  vehicleBrands: false,
  vehicleModels: false,
};
const AUDIT2_INITIAL_COLUMN_FILTERS: ColumnFiltersState = [
  { id: 'severity', value: ['warn', 'crit'] },
];

function severityVariant(
  severity: Audit2Row['severity'],
): 'ok' | 'err' | 'warn' | 'default' {
  if (severity === 'crit') return 'err';
  if (severity === 'warn') return 'warn';
  if (severity === 'info') return 'ok';
  return 'default';
}

function severityLabel(severity: Audit2Row['severity']): string {
  if (severity === 'crit') return 'Crítico';
  if (severity === 'warn') return 'Advertencia';
  return 'Info';
}

function actionBadgeVariant(
  kind: Audit2Row['actionKind'],
): 'brand' | 'warn' | 'default' {
  if (kind === 'entry.corrected') return 'brand';
  if (kind === 'entry.undercharged') return 'warn';
  return 'default';
}

function originBadgeVariant(
  origin: Audit2Row['origin'],
): 'default' | 'brand' | 'warn' {
  if (origin === 'history') return 'brand';
  if (origin === 'operational_exit') return 'warn';
  return 'default';
}

function metadataNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cashSessionLabel(session: CashSession): string {
  const opened = fmtDateTimeAr(session.openedAt);
  return session.closedAt ? `Caja ${opened}` : `Caja actual · ${opened}`;
}

function fallbackCashSessionLabel(cashSessionId: string): string {
  if (cashSessionId === '-') return 'Sin caja';
  return `Caja ${cashSessionId.slice(0, 8)}`;
}

function fmtSignedMoney0(value: number): string {
  if (Math.abs(value) <= 0.005) return fmtMoney0(0);
  return `${value > 0 ? '+' : '-'}${fmtMoney0(Math.abs(value))}`;
}

function QuickSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="dt-quick-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="dt-quick-switch-track" aria-hidden />
    </label>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="audit2-detail-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CorrectionDetail({ row }: { row: Audit2Row }) {
  const comparisons = correctionComparisons(row);
  const impact = row.economicImpact;
  return (
    <>
      {impact ? (
        <section className="audit2-detail-section">
          <h3>Impacto estimado</h3>
          <div className="audit2-money-grid">
            <div>
              <span>Sugerido antes</span>
              <strong>
                {impact.suggestedBefore === null
                  ? '-'
                  : fmtMoney0(impact.suggestedBefore)}
              </strong>
            </div>
            <div>
              <span>Sugerido después</span>
              <strong>
                {impact.suggestedAfter === null
                  ? '-'
                  : fmtMoney0(impact.suggestedAfter)}
              </strong>
            </div>
            <div>
              <span>Impacto horario/tarifa</span>
              <strong>
                {impact.suggestedDelta === null
                  ? '-'
                  : fmtSignedMoney0(impact.suggestedDelta)}
              </strong>
            </div>
            <div>
              <span>Cobrado antes</span>
              <strong>
                {impact.chargedBefore === null
                  ? '-'
                  : fmtMoney0(impact.chargedBefore)}
              </strong>
            </div>
            <div>
              <span>Cobrado después</span>
              <strong>
                {impact.chargedAfter === null
                  ? '-'
                  : fmtMoney0(impact.chargedAfter)}
              </strong>
            </div>
            <div>
              <span>Cambio cobrado</span>
              <strong>
                {impact.chargedDelta === null
                  ? '-'
                  : fmtSignedMoney0(impact.chargedDelta)}
              </strong>
            </div>
            <div>
              <span>Diferencia vs sugerido</span>
              <strong>
                {impact.deltaVsSuggestedAfter === null
                  ? '-'
                  : fmtSignedMoney0(impact.deltaVsSuggestedAfter)}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="audit2-detail-section">
        <h3>Campos modificados</h3>
        <div className="audit2-chip-list">
          {row.changedFieldLabels.length > 0 ? (
            row.changedFieldLabels.map((field) => (
              <Badge key={field} variant="brand">
                {field}
              </Badge>
            ))
          ) : (
            <span className="audit2-muted">Sin campos detectados</span>
          )}
        </div>
      </section>

      <section className="audit2-detail-section">
        <h3>Antes y después</h3>
        <div className="audit2-compare">
          <div className="audit2-compare-head">Campo</div>
          <div className="audit2-compare-head">Antes</div>
          <div className="audit2-compare-head">Después</div>
          {comparisons.map((item) => (
            <div className="audit2-compare-row" key={item.field}>
              <span>
                {item.field}
                {item.changed ? <b>Modificado</b> : null}
              </span>
              <p>{item.before}</p>
              <p>{item.after}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function UnderchargedDetail({ row }: { row: Audit2Row }) {
  const suggested = metadataNumber(row.metadata, 'suggestedAmount');
  const charged = metadataNumber(row.metadata, 'chargedAmount');
  const delta = metadataNumber(row.metadata, 'delta');
  const percent =
    suggested && charged !== null
      ? Math.round((charged / suggested) * 100)
      : null;

  return (
    <section className="audit2-detail-section">
      <h3>Impacto monetario</h3>
      <div className="audit2-money-grid">
        <div>
          <span>Sugerido</span>
          <strong>{suggested === null ? '-' : fmtMoney0(suggested)}</strong>
        </div>
        <div>
          <span>Cobrado</span>
          <strong>{charged === null ? '-' : fmtMoney0(charged)}</strong>
        </div>
        <div>
          <span>Diferencia</span>
          <strong>{delta === null ? '-' : fmtMoney0(delta)}</strong>
        </div>
        <div>
          <span>Porcentaje</span>
          <strong>{percent === null ? '-' : `${percent}%`}</strong>
        </div>
      </div>
    </section>
  );
}

function GenericMetadataDetail({ row }: { row: Audit2Row }) {
  const entries = metadataEntries(row.metadata);
  if (entries.length === 0) {
    return (
      <section className="audit2-detail-section">
        <h3>Metadata</h3>
        <p className="audit2-muted">Este evento no trae metadata adicional.</p>
      </section>
    );
  }

  return (
    <section className="audit2-detail-section">
      <h3>Metadata</h3>
      <div className="audit2-metadata-list">
        {entries.map((entry) => (
          <div key={entry.key}>
            <span>{entry.key}</span>
            <pre>{entry.value}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditDetailDrawer({
  row,
  onClose,
}: {
  row: Audit2Row | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={Boolean(row)}
      onClose={onClose}
      title="Detalle de auditoría"
      width={620}
    >
      {row ? (
        <div className="audit2-drawer-body">
          <div className="audit2-detail-header">
            <div>
              <Badge variant={actionBadgeVariant(row.actionKind)}>
                {row.actionLabel}
              </Badge>
              <h2>{row.summary}</h2>
            </div>
            <Badge variant={severityVariant(row.severity)}>
              {severityLabel(row.severity)}
            </Badge>
          </div>

          <section className="audit2-detail-section">
            <h3>Contexto</h3>
            <div className="audit2-detail-grid">
              <DetailLine label="Fecha" value={fmtDateTimeAr(row.createdAt)} />
              <DetailLine label="Actor" value={row.actorName} />
              <DetailLine label="Rol" value={row.actorRole} />
              <DetailLine
                label="Origen"
                value={
                  <Badge variant={originBadgeVariant(row.origin)}>
                    {row.originLabel}
                  </Badge>
                }
              />
              <DetailLine label="Patente" value={row.plate} />
              <DetailLine label="Ticket" value={row.ticketNumber} />
              <DetailLine label="Caja" value={row.cashSessionId} />
              <DetailLine label="Razón" value={row.reason} />
            </div>
          </section>

          {row.actionKind === 'entry.corrected' ? (
            <CorrectionDetail row={row} />
          ) : null}
          {row.actionKind === 'entry.undercharged' ? (
            <UnderchargedDetail row={row} />
          ) : null}
          {row.actionKind === 'other' ? (
            <GenericMetadataDetail row={row} />
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function Auditoria2Page() {
  const { sucursalId } = useSucursal();
  const userId = useCurrentUserId();
  const [selected, setSelected] = useState<Audit2Row | null>(null);
  const [onlyCurrentCashSession, setOnlyCurrentCashSession] = useState(false);

  const auditQuery = useQuery({
    queryKey: ['audit2', sucursalId],
    queryFn: () => listAuditEvents(sucursalId, { limit: FETCH_LIMIT }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const cashSessionsQuery = useQuery({
    queryKey: ['audit2-cash-sessions', sucursalId],
    queryFn: () => listCashSessions(sucursalId),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const allRows = useMemo(
    () => buildAudit2Rows(auditQuery.data ?? []),
    [auditQuery.data],
  );

  const activeCashSession = useMemo(
    () => cashSessionsQuery.data?.find((session) => !session.closedAt) ?? null,
    [cashSessionsQuery.data],
  );

  useEffect(() => {
    if (!activeCashSession) {
      setOnlyCurrentCashSession(false);
    }
  }, [activeCashSession]);

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (onlyCurrentCashSession) {
        return activeCashSession
          ? row.cashSessionId === activeCashSession.id
          : false;
      }
      return true;
    });
  }, [activeCashSession, allRows, onlyCurrentCashSession]);

  const criticalCount = rows.filter((row) => row.actionKind !== 'other').length;

  const cashSessionOptions = useMemo(() => {
    const byId = new Map<string, string>();
    (cashSessionsQuery.data ?? []).forEach((session) => {
      byId.set(session.id, cashSessionLabel(session));
    });
    allRows.forEach((row) => {
      if (!byId.has(row.cashSessionId)) {
        byId.set(
          row.cashSessionId,
          fallbackCashSessionLabel(row.cashSessionId),
        );
      }
    });
    return Array.from(byId.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [allRows, cashSessionsQuery.data]);

  const columns = useMemo<ColumnDef<Audit2Row, unknown>[]>(
    () => [
      {
        id: 'createdAtLocalDate',
        header: 'Fecha',
        accessorKey: 'createdAtLocalDate',
        filterFn: 'dateRange',
        cell: ({ row }) => (
          <span className="audit2-mono">
            {fmtDateTimeAr(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'enteredAtLocalDate',
        header: 'Ingreso',
        accessorKey: 'enteredAtLocalDate',
        filterFn: 'dateRange',
      },
      {
        id: 'leftAtLocalDate',
        header: 'Egreso',
        accessorKey: 'leftAtLocalDate',
        filterFn: 'dateRange',
      },
      {
        id: 'cashSessionId',
        header: 'Caja',
        accessorKey: 'cashSessionId',
      },
      {
        id: 'paymentMethodNames',
        header: 'Medio de pago',
        accessorKey: 'paymentMethodNames',
      },
      {
        id: 'rateNames',
        header: 'Tarifa',
        accessorKey: 'rateNames',
      },
      {
        id: 'vehicleBrands',
        header: 'Marca',
        accessorKey: 'vehicleBrands',
      },
      {
        id: 'vehicleModels',
        header: 'Modelo',
        accessorKey: 'vehicleModels',
      },
      {
        id: 'colors',
        header: 'Color',
        accessorKey: 'colors',
      },
      {
        id: 'severity',
        header: 'Severidad',
        accessorKey: 'severity',
        size: 128,
        cell: ({ row }) => (
          <Badge
            variant={severityVariant(row.original.severity)}
            className="audit2-table-badge"
          >
            {severityLabel(row.original.severity)}
          </Badge>
        ),
      },
      {
        id: 'actionKind',
        header: 'Acción',
        accessorKey: 'actionKind',
        size: 172,
        cell: ({ row }) => (
          <Badge
            variant={actionBadgeVariant(row.original.actionKind)}
            className="audit2-table-badge audit2-action-badge"
          >
            {row.original.actionLabel}
          </Badge>
        ),
      },
      {
        id: 'actorName',
        header: 'Actor',
        accessorKey: 'actorName',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-1)' }}>
            {row.original.actorName}
          </span>
        ),
      },
      {
        id: 'origin',
        header: 'Rol / origen',
        accessorKey: 'origin',
        size: 152,
        cell: ({ row }) => (
          <div className="audit2-stack">
            <span>{row.original.actorRole}</span>
            <Badge
              variant={originBadgeVariant(row.original.origin)}
              className="audit2-table-badge audit2-origin-badge"
            >
              {row.original.originLabel}
            </Badge>
          </div>
        ),
      },
      {
        id: 'entryKey',
        header: 'Patente / ticket',
        accessorFn: (row) => `${row.plate} ${row.ticketNumber}`,
        cell: ({ row }) => (
          <div className="audit2-stack">
            <strong className="audit2-mono">{row.original.plate}</strong>
            <span>Ticket {row.original.ticketNumber}</span>
          </div>
        ),
      },
      {
        id: 'summary',
        header: 'Resumen',
        accessorKey: 'summary',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {row.original.summary}
          </span>
        ),
      },
      {
        id: 'moneyImpact',
        header: 'Impacto',
        accessorKey: 'moneyImpact',
        cell: ({ row }) => (
          <span
            className="audit2-mono"
            style={{
              color:
                row.original.impactAmount &&
                Math.abs(row.original.impactAmount) > 0.005
                  ? 'var(--warn-text)'
                  : 'var(--text-2)',
              fontWeight: 700,
            }}
          >
            {row.original.moneyImpact}
          </span>
        ),
      },
    ],
    [],
  );

  if (auditQuery.isError) {
    return (
      <div style={{ padding: 32 }}>
        <SectionHeader
          title="Auditoría 2"
          subtitle="Eventos reales del sistema"
        />
        <div className="pk-card">
          <EmptyState
            icon={<IconAlert size={28} />}
            title="No se pudo cargar la auditoría"
            description={translateApiError(auditQuery.error, {
              endpoint: 'entities.audit',
            })}
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={<IconRefresh size={15} />}
                onClick={() => void auditQuery.refetch()}
              >
                Reintentar
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Auditoría 2"
        subtitle={`${rows.length} eventos reales · ${criticalCount} críticos de estadías`}
        kicker="Beta operativa"
      />

      <DataTable<Audit2Row>
        data={rows}
        columns={columns}
        isLoading={auditQuery.isLoading}
        emptyMessage="No hay eventos de auditoría para mostrar."
        searchPlaceholder="Buscar por actor, patente, ticket, razón o campos"
        searchableKeys={['searchText']}
        filterableColumns={[
          'createdAtLocalDate',
          'enteredAtLocalDate',
          'leftAtLocalDate',
          'cashSessionId',
          'paymentMethodNames',
          'rateNames',
          'vehicleBrands',
          'vehicleModels',
          'colors',
          'severity',
          'actionKind',
          'origin',
        ]}
        filterOptionsByColumn={{
          cashSessionId: cashSessionOptions,
          severity: [
            { value: 'info', label: 'Info' },
            { value: 'warn', label: 'Advertencia' },
            { value: 'crit', label: 'Crítico' },
          ],
          actionKind: [
            { value: 'entry.corrected', label: 'Corrección de estadía' },
            { value: 'entry.undercharged', label: 'Cobro menor al sugerido' },
            { value: 'other', label: 'Otros eventos' },
          ],
          origin: [
            { value: 'history', label: 'Historial' },
            { value: 'operational_exit', label: 'Panel operativo' },
            { value: 'unknown', label: 'Sin origen' },
          ],
        }}
        initialColumnFilters={AUDIT2_INITIAL_COLUMN_FILTERS}
        initialColumnVisibility={AUDIT2_INITIAL_COLUMN_VISIBILITY}
        getRowId={(row) => row.id}
        initialPageSize={10}
        onRefresh={() => {
          void auditQuery.refetch();
          void cashSessionsQuery.refetch();
        }}
        refreshDisabled={auditQuery.isFetching || cashSessionsQuery.isFetching}
        onRowClick={setSelected}
        toolbarLeading={
          <div className="dt-quick-switches">
            <QuickSwitch
              label="Solo caja actual"
              checked={onlyCurrentCashSession}
              disabled={!activeCashSession}
              onChange={setOnlyCurrentCashSession}
            />
          </div>
        }
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'owner-audit2' }
            : undefined
        }
      />

      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
