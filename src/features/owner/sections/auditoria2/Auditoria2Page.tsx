import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../../../features/data-table';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import {
  IconAlert,
  IconEye,
  IconRefresh,
} from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import { listAuditEvents } from '../../services/audit';
import {
  buildAudit2Rows,
  correctionComparisons,
  fieldLabel,
  metadataEntries,
  type Audit2Row,
} from './audit2Utils';

const FETCH_LIMIT = 500;

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
  return (
    <>
      <section className="audit2-detail-section">
        <h3>Campos modificados</h3>
        <div className="audit2-chip-list">
          {row.changedFields.length > 0 ? (
            row.changedFields.map((field) => (
              <Badge key={field} variant="brand">
                {fieldLabel(field)}
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

  const auditQuery = useQuery({
    queryKey: ['audit2', sucursalId],
    queryFn: () => listAuditEvents(sucursalId, { limit: FETCH_LIMIT }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const rows = useMemo(
    () => buildAudit2Rows(auditQuery.data ?? []),
    [auditQuery.data],
  );

  const criticalCount = rows.filter((row) => row.actionKind !== 'other').length;

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
        id: 'severity',
        header: 'Severidad',
        accessorKey: 'severity',
        cell: ({ row }) => (
          <Badge variant={severityVariant(row.original.severity)}>
            {severityLabel(row.original.severity)}
          </Badge>
        ),
      },
      {
        id: 'actionKind',
        header: 'Acción',
        accessorKey: 'actionKind',
        cell: ({ row }) => (
          <Badge variant={actionBadgeVariant(row.original.actionKind)}>
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
        cell: ({ row }) => (
          <div className="audit2-stack">
            <span>{row.original.actorRole}</span>
            <Badge variant={originBadgeVariant(row.original.origin)}>
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
                row.original.impactAmount && row.original.impactAmount > 0
                  ? 'var(--warn-text)'
                  : 'var(--text-2)',
              fontWeight: 700,
            }}
          >
            {row.original.moneyImpact}
          </span>
        ),
      },
      {
        id: 'detail',
        header: () => <div style={{ textAlign: 'center' }}>Detalle</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <button
            type="button"
            className="pk-btn pk-btn-ghost pk-btn-icon"
            title="Ver detalle"
            aria-label={`Ver detalle de ${row.original.actionLabel}`}
            onClick={(event) => {
              event.stopPropagation();
              setSelected(row.original);
            }}
          >
            <IconEye size={16} />
          </button>
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
          'severity',
          'actionKind',
          'origin',
          'createdAtLocalDate',
        ]}
        filterOptionsByColumn={{
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
        getRowId={(row) => row.id}
        initialPageSize={10}
        onRefresh={() => void auditQuery.refetch()}
        refreshDisabled={auditQuery.isFetching}
        onRowClick={setSelected}
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
