import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { endOfDay, format, startOfDay } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { DataTable } from '../../../../features/data-table';
import { Pagination } from '../../../../features/data-table/components/Pagination';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import {
  DateRangeFilter,
  type DateRange,
} from '../../../../shared/components/ui/DateRangeFilter';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import {
  IconAlert,
  IconCar,
  IconClock,
  IconDollar,
  IconRefresh,
  IconShield,
  IconTrending,
} from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import { useSucursal } from '../../context/SucursalContext';
import {
  listAuditEvents,
  listCashSessions,
  type CashSession,
} from '../../services/audit';
import {
  getLprDetectionEventImageUrl,
  listLprDetectionEvents,
  type LprDetectionEvent,
} from '../../services/lpr-events';
import {
  buildAuditRows,
  correctionComparisons,
  metadataEntries,
  type AuditRow,
} from './auditUtils';

const FETCH_LIMIT = 500;
const LPR_API_PAGE_SIZE = 100;
const LPR_PAGE_SIZE_OPTIONS = [12, 24, 48];
const LPR_DEFAULT_PAGE_SIZE = 24;
const SUSPICIOUS_LPR_CONFIDENCE = 0.85;
const AUDIT_INITIAL_COLUMN_VISIBILITY = {
  cashSessionId: false,
  colors: false,
  enteredAtLocalDate: false,
  leftAtLocalDate: false,
  paymentMethodNames: false,
  rateNames: false,
  vehicleBrands: false,
  vehicleModels: false,
};
const AUDIT_INITIAL_COLUMN_FILTERS: ColumnFiltersState = [
  { id: 'severity', value: ['warn', 'crit'] },
];
type AuditTab = 'events' | 'lpr';

function severityVariant(
  severity: AuditRow['severity'],
): 'ok' | 'err' | 'warn' | 'default' {
  if (severity === 'crit') return 'err';
  if (severity === 'warn') return 'warn';
  if (severity === 'info') return 'ok';
  return 'default';
}

function severityLabel(severity: AuditRow['severity']): string {
  if (severity === 'crit') return 'Crítico';
  if (severity === 'warn') return 'Advertencia';
  return 'Info';
}

function actionBadgeVariant(
  kind: AuditRow['actionKind'],
): 'brand' | 'warn' | 'default' {
  if (kind === 'entry.corrected') return 'brand';
  if (kind === 'entry.undercharged') return 'warn';
  if (kind === 'invoice.cert_expired') return 'warn';
  return 'default';
}

function originBadgeVariant(
  origin: AuditRow['origin'],
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

function dateRangeKeys(range: DateRange | undefined): {
  from?: string;
  to?: string;
} {
  if (!range?.from) return {};
  return {
    from: format(range.from, 'yyyy-MM-dd'),
    to: format(range.to ?? range.from, 'yyyy-MM-dd'),
  };
}

function dateRangeToQuery(range: DateRange | undefined): {
  firstSeenFrom?: string;
  firstSeenTo?: string;
} {
  if (!range?.from) return {};
  return {
    firstSeenFrom: startOfDay(range.from).toISOString(),
    firstSeenTo: endOfDay(range.to ?? range.from).toISOString(),
  };
}

async function listDismissedLprEventsForAudit(input: {
  tenantId: string;
  firstSeenFrom?: string;
  firstSeenTo?: string;
}): Promise<{ items: LprDetectionEvent[]; total: number }> {
  const firstPage = await listLprDetectionEvents({
    tenantId: input.tenantId,
    status: 'dismissed',
    page: 1,
    pageSize: LPR_API_PAGE_SIZE,
    firstSeenFrom: input.firstSeenFrom,
    firstSeenTo: input.firstSeenTo,
  });
  const items = [...firstPage.items];
  const pageCount = Math.min(
    Math.ceil(firstPage.total / LPR_API_PAGE_SIZE),
    Math.ceil(FETCH_LIMIT / LPR_API_PAGE_SIZE),
  );

  for (let page = 2; page <= pageCount; page += 1) {
    const nextPage = await listLprDetectionEvents({
      tenantId: input.tenantId,
      status: 'dismissed',
      page,
      pageSize: LPR_API_PAGE_SIZE,
      firstSeenFrom: input.firstSeenFrom,
      firstSeenTo: input.firstSeenTo,
    });
    items.push(...nextPage.items);
  }

  return { items: items.slice(0, FETCH_LIMIT), total: firstPage.total };
}

function rowInDateRange(row: AuditRow, range: DateRange | undefined): boolean {
  const { from, to } = dateRangeKeys(range);
  if (!from) return true;
  return (
    row.createdAtLocalDate >= from && row.createdAtLocalDate <= (to ?? from)
  );
}

function lprPlate(event: LprDetectionEvent): string {
  return event.displayPlate ?? event.normalizedText ?? event.rawText ?? '-';
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha';
  return fmtDateTimeAr(iso);
}

function shortId(value: string | null | undefined): string {
  if (!value) return 'Sin usuario';
  return value.slice(0, 8);
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

function CorrectionDetail({ row }: { row: AuditRow }) {
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

function UnderchargedDetail({ row }: { row: AuditRow }) {
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

function CertExpiredDetail({ row }: { row: AuditRow }) {
  const charged = metadataNumber(row.metadata, 'chargedAmount');
  return (
    <section className="audit2-detail-section">
      <h3>Factura pendiente</h3>
      <p className="audit2-muted">
        Se cobraron {charged === null ? 'el monto' : fmtMoney0(charged)} con un
        medio que factura, pero el certificado de ARCA estaba vencido y la
        factura quedó pendiente. Renová el certificado desde Integraciones para
        volver a facturar.
      </p>
      <div>
        <Link
          to="../integraciones/arca/renovar"
          className="pk-btn pk-btn-secondary pk-btn-sm"
          style={{ textDecoration: 'none' }}
        >
          Renovar certificado
        </Link>
      </div>
    </section>
  );
}

function GenericMetadataDetail({ row }: { row: AuditRow }) {
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

function EvidenceImage({
  tenantId,
  event,
}: {
  tenantId: string;
  event: LprDetectionEvent;
}) {
  const imageQuery = useQuery({
    queryKey: [
      'lpr-event-image-url',
      tenantId,
      event.id,
      event.imageStoragePath,
    ],
    queryFn: () =>
      getLprDetectionEventImageUrl({ tenantId, eventId: event.id }),
    enabled: Boolean(event.imageStoragePath),
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });

  if (!event.imageStoragePath) {
    return (
      <div className="lpr-review-image lpr-review-image-empty">
        <IconAlert size={22} />
        <span>Sin imagen</span>
      </div>
    );
  }

  if (imageQuery.isLoading) {
    return (
      <div className="lpr-review-image lpr-review-image-empty">
        <span>Cargando imagen...</span>
      </div>
    );
  }

  if (imageQuery.isError || !imageQuery.data) {
    return (
      <div className="lpr-review-image lpr-review-image-empty">
        <IconAlert size={22} />
        <span>No se pudo cargar</span>
      </div>
    );
  }

  return (
    <img
      className="lpr-review-image"
      src={imageQuery.data}
      alt={`Patente detectada ${lprPlate(event)}`}
    />
  );
}

function LprEvidenceCard({
  tenantId,
  event,
}: {
  tenantId: string;
  event: LprDetectionEvent;
}) {
  const suspicious = event.confidence >= SUSPICIOUS_LPR_CONFIDENCE;

  return (
    <article className="pk-card lpr-review-card">
      <EvidenceImage tenantId={tenantId} event={event} />

      <div className="lpr-review-card-body">
        <div className="lpr-review-card-head">
          <div>
            <p className="lpr-review-kicker">Patente descartada</p>
            <h3>{lprPlate(event)}</h3>
          </div>
          <Badge variant={suspicious ? 'err' : 'warn'}>
            {formatConfidence(event.confidence)}
          </Badge>
        </div>

        <div className="lpr-review-meta-grid">
          <div>
            <span>Detectada</span>
            <strong>{formatDateTime(event.firstSeenAt)}</strong>
          </div>
          <div>
            <span>Descartada</span>
            <strong>
              {formatDateTime(event.reviewedAt ?? event.updatedAt)}
            </strong>
          </div>
          <div>
            <span>Cámara</span>
            <strong>{event.cameraId}</strong>
          </div>
          <div>
            <span>Ubicación</span>
            <strong>{event.location}</strong>
          </div>
          <div>
            <span>Operario</span>
            <strong>{event.reviewedByName ?? 'Sin operario'}</strong>
          </div>
          <div>
            <span>Evento</span>
            <strong>{shortId(event.id)}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}

type AuditRiskMetrics = {
  chargeReductionLoss: number;
  periodEvents: number;
  possibleLoss: number;
  suspiciousDismissals: number;
  suggestedReductionRisk: number;
  underchargedLoss: number;
};

function MetricCard({
  icon,
  label,
  tone = 'default',
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'default' | 'warn' | 'err';
  value: string;
}) {
  return (
    <div className={`audit-risk-card ${tone}`}>
      <div className="audit-risk-card-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function RiskBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 0;

  return (
    <div className="audit-risk-bar-row">
      <span>{label}</span>
      <div className="audit-risk-bar-track">
        <div className="audit-risk-bar-fill" style={{ width: `${width}%` }} />
      </div>
      <strong>{fmtMoney0(value)}</strong>
    </div>
  );
}

function AuditRiskOverview({ metrics }: { metrics: AuditRiskMetrics }) {
  const maxRisk = Math.max(
    metrics.underchargedLoss,
    metrics.chargeReductionLoss,
    metrics.suggestedReductionRisk,
  );

  return (
    <div className="audit-risk-grid">
      <MetricCard
        icon={<IconDollar size={18} />}
        label="Pérdida posible"
        tone={metrics.possibleLoss > 0 ? 'err' : 'default'}
        value={fmtMoney0(metrics.possibleLoss)}
      />
      <MetricCard
        icon={<IconTrending size={18} />}
        label="Riesgo por horario/tarifa"
        tone={metrics.suggestedReductionRisk > 0 ? 'warn' : 'default'}
        value={fmtMoney0(metrics.suggestedReductionRisk)}
      />
      <MetricCard
        icon={<IconCar size={18} />}
        label="Descartes sospechosos"
        tone={metrics.suspiciousDismissals > 0 ? 'warn' : 'default'}
        value={String(metrics.suspiciousDismissals)}
      />
      <MetricCard
        icon={<IconShield size={18} />}
        label="Eventos auditables"
        value={String(metrics.periodEvents)}
      />
      <div className="audit-risk-chart">
        <div>
          <span>Desglose económico del período</span>
          <strong>{fmtMoney0(metrics.possibleLoss)}</strong>
        </div>
        <RiskBar
          label="Cobros bajo sugerido"
          value={metrics.underchargedLoss}
          max={maxRisk}
        />
        <RiskBar
          label="Correcciones que bajan cobro"
          value={metrics.chargeReductionLoss}
          max={maxRisk}
        />
        <RiskBar
          label="Horario o tarifa reducida"
          value={metrics.suggestedReductionRisk}
          max={maxRisk}
        />
      </div>
    </div>
  );
}

function LprReviewTab({
  events,
  isError,
  isLoading,
  isFetching,
  onRefresh,
  pageIndex,
  pageSize,
  setPageIndex,
  setPageSize,
  tenantId,
  total,
}: {
  events: LprDetectionEvent[];
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  pageIndex: number;
  pageSize: number;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  tenantId: string;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageEvents = events.slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
  );

  if (isLoading) {
    return (
      <div className="pk-card pk-card-pad lpr-review-loading">
        <IconClock size={18} />
        <span>Cargando descartes...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pk-card">
        <EmptyState
          icon={<IconAlert size={28} />}
          title="No se pudieron cargar las patentes descartadas"
          description="Probá actualizar la sección."
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={<IconRefresh size={15} />}
              onClick={onRefresh}
              loading={isFetching}
            >
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="pk-card">
        <EmptyState
          icon={<IconCar size={32} />}
          title="Sin descartes LPR"
          description="No hay patentes descartadas por el operario en el rango seleccionado."
        />
      </div>
    );
  }

  return (
    <>
      <div className="lpr-review-grid">
        {pageEvents.map((event) => (
          <LprEvidenceCard key={event.id} tenantId={tenantId} event={event} />
        ))}
      </div>

      <Pagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={pageCount}
        totalRows={total}
        pageSizeOptions={LPR_PAGE_SIZE_OPTIONS}
        canPreviousPage={pageIndex > 0}
        canNextPage={pageIndex < pageCount - 1}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPageIndex(0);
        }}
      />
    </>
  );
}

function AuditDetailDrawer({
  row,
  onClose,
}: {
  row: AuditRow | null;
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
          {row.actionKind === 'invoice.cert_expired' ? (
            <CertExpiredDetail row={row} />
          ) : null}
          {row.actionKind === 'other' ? (
            <GenericMetadataDetail row={row} />
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function AuditoriaPage() {
  const { sucursal, sucursalId } = useSucursal();
  const userId = useCurrentUserId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [onlyCurrentCashSession, setOnlyCurrentCashSession] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [lprPageIndex, setLprPageIndex] = useState(0);
  const [lprPageSize, setLprPageSize] = useState(LPR_DEFAULT_PAGE_SIZE);
  const activeTab: AuditTab =
    searchParams.get('tab') === 'lpr' ? 'lpr' : 'events';

  function handleTabChange(tab: AuditTab) {
    const next = new URLSearchParams(searchParams);
    if (tab === 'lpr') {
      next.set('tab', 'lpr');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  }

  function handleDateRangeChange(next: DateRange | undefined) {
    setDateRange(next);
    setLprPageIndex(0);
  }

  const auditQuery = useQuery({
    queryKey: ['audit', sucursalId],
    queryFn: () => listAuditEvents(sucursalId, { limit: FETCH_LIMIT }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const cashSessionsQuery = useQuery({
    queryKey: ['audit-cash-sessions', sucursalId],
    queryFn: () => listCashSessions(sucursalId),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const lprDateQuery = useMemo(() => dateRangeToQuery(dateRange), [dateRange]);

  const lprQuery = useQuery({
    queryKey: [
      'audit-lpr-events',
      sucursalId,
      'dismissed',
      lprDateQuery.firstSeenFrom,
      lprDateQuery.firstSeenTo,
    ],
    queryFn: () =>
      listDismissedLprEventsForAudit({
        tenantId: sucursalId,
        firstSeenFrom: lprDateQuery.firstSeenFrom,
        firstSeenTo: lprDateQuery.firstSeenTo,
      }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const allRows = useMemo(
    () => buildAuditRows(auditQuery.data ?? []),
    [auditQuery.data],
  );

  const periodRows = useMemo(
    () => allRows.filter((row) => rowInDateRange(row, dateRange)),
    [allRows, dateRange],
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
    return periodRows.filter((row) => {
      if (onlyCurrentCashSession) {
        return activeCashSession
          ? row.cashSessionId === activeCashSession.id
          : false;
      }
      return true;
    });
  }, [activeCashSession, onlyCurrentCashSession, periodRows]);

  const lprEvents = lprQuery.data?.items ?? [];
  const lprTotal = lprEvents.length;
  const suspiciousDismissals = lprEvents.filter(
    (event) => event.confidence >= SUSPICIOUS_LPR_CONFIDENCE,
  ).length;
  const criticalCount = periodRows.filter(
    (row) => row.actionKind !== 'other',
  ).length;
  const riskMetrics = useMemo<AuditRiskMetrics>(() => {
    let underchargedLoss = 0;
    let chargeReductionLoss = 0;
    let suggestedReductionRisk = 0;

    periodRows.forEach((row) => {
      if (row.actionKind === 'entry.undercharged') {
        underchargedLoss += Math.max(row.impactAmount ?? 0, 0);
        return;
      }

      if (row.actionKind !== 'entry.corrected') return;

      const chargedDelta =
        row.economicImpact?.chargedDelta ?? row.impactAmount ?? null;
      if (chargedDelta !== null && chargedDelta < -0.005) {
        chargeReductionLoss += Math.abs(chargedDelta);
      }

      const suggestedDelta = row.economicImpact?.suggestedDelta;
      if (suggestedDelta !== null && suggestedDelta !== undefined) {
        if (suggestedDelta < -0.005) {
          suggestedReductionRisk += Math.abs(suggestedDelta);
        }
      }
    });

    return {
      chargeReductionLoss,
      periodEvents: periodRows.length,
      possibleLoss: underchargedLoss + chargeReductionLoss,
      suspiciousDismissals,
      suggestedReductionRisk,
      underchargedLoss,
    };
  }, [periodRows, suspiciousDismissals]);

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

  const columns = useMemo<ColumnDef<AuditRow, unknown>[]>(
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

  return (
    <div className="audit-page">
      <SectionHeader
        title="Auditoría"
        subtitle={
          sucursal
            ? `${sucursal.nombre} · ${criticalCount} eventos críticos o advertencias`
            : `${criticalCount} eventos críticos o advertencias`
        }
        action={
          <div className="audit-header-actions">
            <DateRangeFilter
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder="Período auditado"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<IconRefresh size={15} />}
              onClick={() => {
                void auditQuery.refetch();
                void cashSessionsQuery.refetch();
                void lprQuery.refetch();
              }}
              loading={
                auditQuery.isFetching ||
                cashSessionsQuery.isFetching ||
                lprQuery.isFetching
              }
            >
              Actualizar
            </Button>
          </div>
        }
      />

      <AuditRiskOverview metrics={riskMetrics} />

      <div className="audit-tabs" role="tablist" aria-label="Auditoría">
        <button
          type="button"
          className={activeTab === 'events' ? 'active' : undefined}
          onClick={() => handleTabChange('events')}
          role="tab"
          aria-selected={activeTab === 'events'}
        >
          Eventos
          <span>{rows.length}</span>
        </button>
        <button
          type="button"
          className={activeTab === 'lpr' ? 'active' : undefined}
          onClick={() => handleTabChange('lpr')}
          role="tab"
          aria-selected={activeTab === 'lpr'}
        >
          Patentes descartadas
          <span>{lprTotal}</span>
        </button>
      </div>

      {activeTab === 'events' ? (
        auditQuery.isError ? (
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
        ) : (
          <DataTable<AuditRow>
            data={rows}
            columns={columns}
            isLoading={auditQuery.isLoading}
            emptyMessage="No hay eventos de auditoría para mostrar."
            searchPlaceholder="Buscar por actor, patente, ticket, razón o campos"
            searchableKeys={['searchText']}
            filterableColumns={[
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
                {
                  value: 'entry.undercharged',
                  label: 'Cobro menor al sugerido',
                },
                { value: 'invoice.cert_expired', label: 'Cobro sin factura' },
                { value: 'other', label: 'Otros eventos' },
              ],
              origin: [
                { value: 'history', label: 'Historial' },
                { value: 'operational_exit', label: 'Panel operativo' },
                { value: 'unknown', label: 'Sin origen' },
              ],
            }}
            initialColumnFilters={AUDIT_INITIAL_COLUMN_FILTERS}
            initialColumnVisibility={AUDIT_INITIAL_COLUMN_VISIBILITY}
            getRowId={(row) => row.id}
            initialPageSize={10}
            onRefresh={() => {
              void auditQuery.refetch();
              void cashSessionsQuery.refetch();
            }}
            refreshDisabled={
              auditQuery.isFetching || cashSessionsQuery.isFetching
            }
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
                ? { userId, tenantId: sucursalId, tableKey: 'owner-audit' }
                : undefined
            }
          />
        )
      ) : (
        <LprReviewTab
          events={lprEvents}
          isError={lprQuery.isError}
          isLoading={lprQuery.isLoading}
          isFetching={lprQuery.isFetching}
          onRefresh={() => void lprQuery.refetch()}
          pageIndex={lprPageIndex}
          pageSize={lprPageSize}
          setPageIndex={setLprPageIndex}
          setPageSize={setLprPageSize}
          tenantId={sucursalId}
          total={lprTotal}
        />
      )}

      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
