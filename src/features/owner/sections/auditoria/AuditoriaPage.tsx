import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { endOfDay, format, startOfDay } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { DataTable } from '../../../../features/data-table';
import { VehicleCell } from '../../../../features/data-table/components/VehicleCell';
import {
  dateTimeSorting,
  normalizeText,
} from '../../../../features/data-table/utils';
import { Pagination } from '../../../../features/data-table/components/Pagination';
import { translateApiError } from '../../../../lib/api/translate';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useCloseOnOutsideClick } from '../../../../lib/ui/useCloseOnOutsideClick';
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
  IconMaximize,
  IconRefresh,
  IconShield,
  IconTrending,
} from '../../../../shared/components/icons';
import { Modal } from '../../../../shared/components/ui/Modal';
import { isLegacyEvidence, plateOverlayStyle } from './lprImage';
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
  buildOwnerAuditRows,
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
  vehicle: false,
  vehicleBrands: false,
  vehicleModels: false,
};
const AUDIT_INITIAL_COLUMN_FILTERS: ColumnFiltersState = [
  { id: 'severity', value: ['warn', 'crit'] },
];
const LPR_ZOOM_MIN = 1;
const LPR_ZOOM_MAX = 4;
const LPR_ZOOM_STEP = 0.25;
type AuditTab = 'events' | 'lpr';

type LprFilterId = 'firstSeenAt' | 'severity';

type LprOptionFilterId = 'severity';

type LprFilterState = {
  firstSeenAt?: DateRange;
  severity: string[];
};

type LprFilterOption = {
  value: string;
  label: string;
  count: number;
};

type LprAuditRow = {
  event: LprDetectionEvent;
  plate: string;
  firstSeenAt: string;
  severity: string[];
  searchText: string;
};

const LPR_EMPTY_FILTERS: LprFilterState = {
  severity: [],
};

const LPR_FILTER_LABELS: Record<LprFilterId, string> = {
  firstSeenAt: 'Ingreso',
  severity: 'Severidad',
};

const LPR_OPTION_FILTERS: LprOptionFilterId[] = ['severity'];

const LPR_FILTER_OPTION_LABELS: Partial<Record<string, string>> = {
  info: 'Info',
  warn: 'Advertencia',
};

function clampLprZoom(value: number): number {
  return Math.min(LPR_ZOOM_MAX, Math.max(LPR_ZOOM_MIN, value));
}

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
  if (kind === 'entry.deleted') return 'warn';
  if (kind === 'entry.undercharged') return 'warn';
  if (kind === 'invoice.cert_expired') return 'warn';
  return 'default';
}

function originBadgeVariant(
  origin: AuditRow['origin'],
): 'default' | 'brand' | 'warn' {
  if (origin === 'history') return 'brand';
  if (origin === 'desktop') return 'brand';
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

function lprSeverity(event: LprDetectionEvent): string {
  return event.confidence >= SUSPICIOUS_LPR_CONFIDENCE ? 'warn' : 'info';
}

function lprEventToAuditRow(event: LprDetectionEvent): LprAuditRow {
  const plate = lprPlate(event);

  return {
    event,
    plate,
    firstSeenAt: event.firstSeenAt,
    severity: [lprSeverity(event)],
    searchText: [plate, event.rawText, event.normalizedText, event.displayPlate]
      .filter(Boolean)
      .join(' '),
  };
}

function dateInRange(
  iso: string | null | undefined,
  range: DateRange | undefined,
): boolean {
  if (!range?.from) return true;
  if (!iso) return false;
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return false;
  const from = startOfDay(range.from).getTime();
  const to = endOfDay(range.to ?? range.from).getTime();
  return value >= from && value <= to;
}

function optionLabel(value: string): string {
  return LPR_FILTER_OPTION_LABELS[value] ?? value;
}

function buildLprFilterOptions(
  rows: LprAuditRow[],
): Record<LprOptionFilterId, LprFilterOption[]> {
  return Object.fromEntries(
    LPR_OPTION_FILTERS.map((filterId) => {
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        row[filterId].forEach((value) => {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        });
      });

      const options = Array.from(counts.entries())
        .map(([value, count]) => ({
          value,
          count,
          label: optionLabel(value),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'es'));

      return [filterId, options];
    }),
  ) as Record<LprOptionFilterId, LprFilterOption[]>;
}

function filterLprRows(
  rows: LprAuditRow[],
  search: string,
  filters: LprFilterState,
): LprAuditRow[] {
  const query = normalizeText(search);

  return rows.filter((row) => {
    if (query && !normalizeText(row.searchText).includes(query)) return false;
    if (!dateInRange(row.firstSeenAt, filters.firstSeenAt)) return false;

    return LPR_OPTION_FILTERS.every((filterId) => {
      const selected = filters[filterId];
      if (selected.length === 0) return true;
      return row[filterId].some((value) => selected.includes(value));
    });
  });
}

function countActiveLprFilters(filters: LprFilterState): number {
  const dateCount = filters.firstSeenAt?.from ? 1 : 0;
  return dateCount + filters.severity.length;
}

function clearLprFilters(): LprFilterState {
  return { ...LPR_EMPTY_FILTERS };
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

function DeletedEntryDetail({ row }: { row: AuditRow }) {
  const amount = metadataNumber(row.metadata, 'amountPaid');
  return (
    <section className="audit2-detail-section">
      <h3>Cobro retirado</h3>
      <p className="audit2-muted">
        {amount !== null && amount > 0
          ? `Se retiraron ${fmtMoney0(amount)} de la caja. La baja no devuelve dinero al cliente.`
          : 'Este ingreso no tenía un cobro asociado.'}
      </p>
    </section>
  );
}

function GenericMetadataDetail({ row }: { row: AuditRow }) {
  const entries = metadataEntries(row);
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
  // La MISMA queryKey que usa el modal: React Query comparte el resultado, así
  // que ampliar no dispara un segundo request ni firma una segunda URL.
  const [zoomed, setZoomed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  function updateZoom(delta: number, point?: { x: number; y: number }) {
    const next = clampLprZoom(zoom + delta);
    if (next === zoom) return;

    const rect = frameRef.current?.getBoundingClientRect();
    const origin = rect
      ? {
          x: point ? point.x - rect.left : rect.width / 2,
          y: point ? point.y - rect.top : rect.height / 2,
        }
      : null;

    if (next === 1 || !origin) {
      setPan({ x: 0, y: 0 });
      setZoom(next);
      return;
    }

    setPan((current) => ({
      x: origin.x - ((origin.x - current.x) / zoom) * next,
      y: origin.y - ((origin.y - current.y) / zoom) * next,
    }));
    setZoom(next);
  }

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!zoomed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomed]);

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

  const bbox = event.plateBbox ?? null;
  const legacy = isLegacyEvidence(event);

  return (
    <>
      <button
        type="button"
        className="lpr-review-image-button"
        onClick={() => setZoomed(true)}
        aria-label={`Ver la imagen completa de la detección ${lprPlate(event)}`}
      >
        {/* La card muestra la foto completa en su proporción real: el bbox viene
            normalizado contra esa imagen, así que recortar con CSS lo desfasaba. */}
        <span className="lpr-review-image-stage">
          <img
            className="lpr-review-image"
            src={imageQuery.data}
            alt={`Patente detectada ${lprPlate(event)}`}
          />
          {bbox ? (
            <span
              className="lpr-review-plate"
              style={plateOverlayStyle(bbox)}
            />
          ) : null}
        </span>
        <span className="lpr-review-image-expand">
          <IconMaximize size={13} />
          Ver vehículo
        </span>
      </button>

      <Modal
        open={zoomed}
        onClose={() => {
          setZoomed(false);
          resetZoom();
        }}
        title={`Detección ${lprPlate(event)}`}
        width={960}
        fitContent
        bodyScrollable={false}
        bodyStyle={{ overflow: 'hidden' }}
      >
        <div className="lpr-zoom-toolbar" aria-label="Zoom de imagen">
          <button
            type="button"
            className="pk-btn pk-btn-secondary"
            onClick={() => updateZoom(-LPR_ZOOM_STEP)}
            disabled={zoom <= LPR_ZOOM_MIN}
            aria-label="Alejar"
          >
            -
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="pk-btn pk-btn-secondary"
            onClick={() => updateZoom(LPR_ZOOM_STEP)}
            disabled={zoom >= LPR_ZOOM_MAX}
            aria-label="Acercar"
          >
            +
          </button>
          <button
            type="button"
            className="pk-btn pk-btn-secondary"
            onClick={resetZoom}
            disabled={zoom === 1}
          >
            Restablecer
          </button>
        </div>
        <div
          ref={frameRef}
          className={`lpr-zoom-frame${zoom > 1 ? ' is-pannable' : ''}${dragging ? ' is-dragging' : ''}`}
          onWheel={(wheelEvent) => {
            wheelEvent.preventDefault();
            updateZoom(wheelEvent.deltaY < 0 ? LPR_ZOOM_STEP : -LPR_ZOOM_STEP, {
              x: wheelEvent.clientX,
              y: wheelEvent.clientY,
            });
          }}
          onPointerDown={(pointerEvent) => {
            if (zoom <= 1 || pointerEvent.button !== 0) return;
            pointerEvent.currentTarget.setPointerCapture(
              pointerEvent.pointerId,
            );
            dragRef.current = {
              pointerId: pointerEvent.pointerId,
              startX: pointerEvent.clientX,
              startY: pointerEvent.clientY,
              panX: pan.x,
              panY: pan.y,
            };
            setDragging(true);
          }}
          onPointerMove={(pointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== pointerEvent.pointerId) return;
            setPan({
              x: drag.panX + pointerEvent.clientX - drag.startX,
              y: drag.panY + pointerEvent.clientY - drag.startY,
            });
          }}
          onPointerUp={(pointerEvent) => {
            if (dragRef.current?.pointerId !== pointerEvent.pointerId) return;
            dragRef.current = null;
            setDragging(false);
            pointerEvent.currentTarget.releasePointerCapture(
              pointerEvent.pointerId,
            );
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragging(false);
          }}
        >
          <div
            className="lpr-zoom-stage"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <img
              src={imageQuery.data}
              alt={`Detección ${lprPlate(event)}`}
              draggable={false}
            />
            {bbox ? (
              <div className="lpr-zoom-plate" style={plateOverlayStyle(bbox)} />
            ) : null}
          </div>
        </div>
        {legacy ? (
          <p className="lpr-zoom-note">
            Detección anterior: de este evento sólo se conservó el recorte de la
            patente, no la foto completa del vehículo.
          </p>
        ) : null}
      </Modal>
    </>
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

function LprFiltersPanel({
  filters,
  onChange,
  options,
}: {
  filters: LprFilterState;
  onChange: (filters: LprFilterState) => void;
  options: Record<LprOptionFilterId, LprFilterOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>();
  const closePanel = useCallback(() => setOpen(false), []);
  const activeCount = countActiveLprFilters(filters);

  useCloseOnOutsideClick(panelRef, open, closePanel);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const gutter = 18;
    const width = Math.min(340, window.innerWidth - gutter * 2);
    const maxLeft = Math.max(gutter, window.innerWidth - width - gutter);
    const left = Math.min(Math.max(triggerRect.left, gutter), maxLeft);

    setPanelStyle({
      position: 'fixed',
      top: triggerRect.bottom + 8,
      left,
      right: 'auto',
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  function setDateFilter(
    filterId: 'firstSeenAt',
    value: DateRange | undefined,
  ) {
    onChange({ ...filters, [filterId]: value });
  }

  function toggleValue(filterId: LprOptionFilterId, value: string): void {
    const current = filters[filterId];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange({ ...filters, [filterId]: next });
  }

  return (
    <div className="dt-menu dt-filter-menu" ref={panelRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`dt-toolbar-button dt-filter-trigger ${open ? 'active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal size={16} />
        Filtros
        {activeCount > 0 ? (
          <span className="dt-button-count">{activeCount}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="dt-menu-panel dt-filter-panel"
          aria-label="Filtros de patentes descartadas"
          style={panelStyle}
        >
          <div className="dt-menu-heading dt-filter-heading">
            <span>
              Filtros
              {activeCount > 0 ? <b>{activeCount}</b> : null}
            </span>
            <button type="button" onClick={() => onChange(clearLprFilters())}>
              <RotateCcw size={14} /> Limpiar
            </button>
          </div>

          <div className="dt-filter-list">
            <div className="dt-filter-date-row">
              <span className="dt-filter-date-label">
                <CalendarDays size={15} />
                {LPR_FILTER_LABELS.firstSeenAt}
              </span>
              <DateRangeFilter
                value={filters.firstSeenAt}
                onChange={(next) => setDateFilter('firstSeenAt', next)}
                placeholder="Elegir fecha"
              />
            </div>
            <section className="dt-filter-section open">
              <div className="dt-filter-section-header" role="presentation">
                <SlidersHorizontal size={15} />
                <span>{LPR_FILTER_LABELS.severity}</span>
                {filters.severity.length > 0 ? (
                  <b>{filters.severity.length}</b>
                ) : null}
              </div>
              <div className="dt-filter-options">
                <div className="dt-filter-options-scroll">
                  {options.severity.map((option) => (
                    <label className="dt-check-row" key={option.value}>
                      <input
                        type="checkbox"
                        checked={filters.severity.includes(option.value)}
                        onChange={() => toggleValue('severity', option.value)}
                      />
                      <span>{option.label}</span>
                      <small>{option.count}</small>
                    </label>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LprReviewToolbar({
  filters,
  isFetching,
  onFiltersChange,
  onRefresh,
  onSearchChange,
  options,
  search,
}: {
  filters: LprFilterState;
  isFetching: boolean;
  onFiltersChange: (filters: LprFilterState) => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  options: Record<LprOptionFilterId, LprFilterOption[]>;
  search: string;
}) {
  return (
    <section className="dt-card lpr-review-toolbar-card">
      <div className="dt-toolbar">
        <div className="dt-search-cluster">
          <label className="dt-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por patente"
            />
            {search ? (
              <button
                type="button"
                className="dt-search-clear"
                onClick={() => onSearchChange('')}
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            className="dt-search-side-button"
            onClick={onRefresh}
            disabled={isFetching}
            title="Recargar datos"
          >
            <IconRefresh size={17} />
          </button>
        </div>
        <div className="dt-toolbar-actions">
          <LprFiltersPanel
            filters={filters}
            onChange={onFiltersChange}
            options={options}
          />
        </div>
      </div>
    </section>
  );
}

function LprReviewTab({
  events,
  filters,
  isError,
  isLoading,
  isFetching,
  onFiltersChange,
  onRefresh,
  onSearchChange,
  pageIndex,
  pageSize,
  search,
  setPageIndex,
  setPageSize,
  tenantId,
}: {
  events: LprDetectionEvent[];
  filters: LprFilterState;
  isError: boolean;
  isLoading: boolean;
  isFetching: boolean;
  onFiltersChange: (filters: LprFilterState) => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  pageIndex: number;
  pageSize: number;
  search: string;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  tenantId: string;
}) {
  const rows = useMemo(
    () => events.map((event) => lprEventToAuditRow(event)),
    [events],
  );
  const filterOptions = useMemo(() => buildLprFilterOptions(rows), [rows]);
  const filteredRows = useMemo(
    () => filterLprRows(rows, search, filters),
    [filters, rows, search],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice(
    pageIndex * pageSize,
    (pageIndex + 1) * pageSize,
  );

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageCount, pageIndex, setPageIndex]);

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

  return (
    <>
      <LprReviewToolbar
        filters={filters}
        isFetching={isFetching}
        onFiltersChange={onFiltersChange}
        onRefresh={onRefresh}
        onSearchChange={onSearchChange}
        options={filterOptions}
        search={search}
      />

      {events.length === 0 ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconCar size={32} />}
            title="Sin descartes LPR"
            description="No hay patentes descartadas por el operario en el rango seleccionado."
          />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconCar size={32} />}
            title="Sin resultados"
            description="No hay patentes descartadas que coincidan con los filtros aplicados."
          />
        </div>
      ) : (
        <div className="lpr-review-grid">
          {pageRows.map((row) => (
            <LprEvidenceCard
              key={row.event.id}
              tenantId={tenantId}
              event={row.event}
            />
          ))}
        </div>
      )}

      <Pagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={pageCount}
        totalRows={filteredRows.length}
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
  cashSessions,
  onClose,
}: {
  row: AuditRow | null;
  cashSessions: CashSession[];
  onClose: () => void;
}) {
  const cashSession = cashSessions.find(
    (session) => session.id === row?.cashSessionId,
  );
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
              <DetailLine
                label="Caja"
                value={
                  cashSession
                    ? cashSessionLabel(cashSession)
                    : fallbackCashSessionLabel(row.cashSessionId)
                }
              />
              {row.reason !== '-' ? (
                <DetailLine label="Razón" value={row.reason} />
              ) : null}
            </div>
          </section>

          {row.actionKind === 'entry.corrected' ? (
            <CorrectionDetail row={row} />
          ) : null}
          {row.actionKind === 'entry.deleted' ? (
            <DeletedEntryDetail row={row} />
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
  // Filas visibles en la tabla de eventos con todos los filtros activos.
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [lprSearch, setLprSearch] = useState('');
  const [lprFilters, setLprFilters] = useState<LprFilterState>(() =>
    clearLprFilters(),
  );
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

  function handleLprSearchChange(next: string) {
    setLprSearch(next);
    setLprPageIndex(0);
  }

  function handleLprFiltersChange(next: LprFilterState) {
    setLprFilters(next);
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
    () => buildOwnerAuditRows(auditQuery.data ?? []),
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
  const lprRowsForCount = useMemo(
    () => lprEvents.map((event) => lprEventToAuditRow(event)),
    [lprEvents],
  );
  const filteredLprTotal = useMemo(
    () => filterLprRows(lprRowsForCount, lprSearch, lprFilters).length,
    [lprFilters, lprRowsForCount, lprSearch],
  );
  const suspiciousDismissals = lprEvents.filter(
    (event) => event.confidence >= SUSPICIOUS_LPR_CONFIDENCE,
  ).length;
  // Eventos que el dueño tiene que mirar: severidad real warn o crit.
  const criticalCount = periodRows.filter(
    (row) => row.severity === 'warn' || row.severity === 'crit',
  ).length;
  // Con la pestaña de eventos activa manda el conteo de la tabla (todos los
  // filtros). Sin la tabla montada (pestaña Patentes) se aproxima con el
  // filtro por defecto de severidad, y se descarta lo que quedó viejo.
  useEffect(() => {
    if (activeTab !== 'events') setVisibleCount(null);
  }, [activeTab, rows]);
  const eventsCount =
    visibleCount ??
    rows.filter((row) => row.severity === 'warn' || row.severity === 'crit')
      .length;
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
      periodEvents: eventsCount,
      possibleLoss: underchargedLoss + chargeReductionLoss,
      suspiciousDismissals,
      suggestedReductionRisk,
      underchargedLoss,
    };
  }, [periodRows, suspiciousDismissals, eventsCount]);

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
        sortingFn: dateTimeSorting((row) => row.createdAt),
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
        sortingFn: dateTimeSorting((row) => row.enteredAt),
      },
      {
        id: 'leftAtLocalDate',
        header: 'Egreso',
        accessorKey: 'leftAtLocalDate',
        filterFn: 'dateRange',
        sortingFn: dateTimeSorting((row) => row.leftAt),
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
        id: 'vehicle',
        header: 'Vehículo',
        accessorFn: (row) =>
          [...row.vehicleBrands, ...row.vehicleModels, ...row.colors].join(' '),
        size: 175,
        meta: {
          exportValue: (row) =>
            [...row.vehicleBrands, ...row.vehicleModels, ...row.colors].join(
              '\n',
            ),
        },
        cell: ({ row }) => (
          <VehicleCell
            brand={row.original.vehicleBrands.join(', ')}
            model={row.original.vehicleModels.join(', ')}
            colors={row.original.colors}
          />
        ),
      },
      {
        id: 'vehicleBrands',
        header: 'Marca',
        accessorKey: 'vehicleBrands',
        enableHiding: false,
        meta: { filterOnly: true, displayColumnId: 'vehicle' },
      },
      {
        id: 'vehicleModels',
        header: 'Modelo',
        accessorKey: 'vehicleModels',
        enableHiding: false,
        meta: { filterOnly: true, displayColumnId: 'vehicle' },
      },
      {
        id: 'colors',
        header: 'Color',
        accessorKey: 'colors',
        enableHiding: false,
        meta: { filterOnly: true, displayColumnId: 'vehicle' },
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
          <span>{eventsCount}</span>
        </button>
        <button
          type="button"
          className={activeTab === 'lpr' ? 'active' : undefined}
          onClick={() => handleTabChange('lpr')}
          role="tab"
          aria-selected={activeTab === 'lpr'}
        >
          Patentes descartadas
          <span>{filteredLprTotal}</span>
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
            searchPlaceholder="Buscar por patente, actor, nro de ticket, razón o campo modificado"
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
                { value: 'entry.deleted', label: 'Ingreso eliminado' },
                {
                  value: 'entry.undercharged',
                  label: 'Cobro menor al sugerido',
                },
                { value: 'invoice.cert_expired', label: 'Cobro sin factura' },
                { value: 'other', label: 'Evento del sistema' },
              ],
              origin: [
                { value: 'history', label: 'Historial' },
                { value: 'operational_exit', label: 'Panel operativo' },
                { value: 'desktop', label: 'Aplicación desktop' },
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
            onFilteredCountChange={setVisibleCount}
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
          filters={lprFilters}
          isError={lprQuery.isError}
          isLoading={lprQuery.isLoading}
          isFetching={lprQuery.isFetching}
          onFiltersChange={handleLprFiltersChange}
          onRefresh={() => void lprQuery.refetch()}
          onSearchChange={handleLprSearchChange}
          pageIndex={lprPageIndex}
          pageSize={lprPageSize}
          search={lprSearch}
          setPageIndex={setLprPageIndex}
          setPageSize={setLprPageSize}
          tenantId={sucursalId}
        />
      )}

      <AuditDetailDrawer
        row={selected}
        cashSessions={cashSessionsQuery.data ?? []}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
