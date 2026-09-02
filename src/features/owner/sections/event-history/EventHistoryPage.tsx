import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import {
  IconAlert,
  IconCar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEye,
  IconSearch,
} from '../../../../shared/components/icons';
import { useSucursal } from '../../context/SucursalContext';
import {
  getLprDetectionEventImageUrl,
  listLprEventHistory,
  type LprEventDirection,
  type LprEventHistoryFilters,
  type LprEventHistoryItem,
} from '../../services/lpr-events';

const PAGE_SIZE = 24;

/** Argentina has no DST; a fixed offset keeps the day boundaries intuitive. */
const AR_OFFSET = '-03:00';

type DirectionOption = 'todos' | LprEventDirection;

interface DraftFilters {
  from: string;
  to: string;
  plate: string;
  direction: DirectionOption;
}

const EMPTY_DRAFT: DraftFilters = {
  from: '',
  to: '',
  plate: '',
  direction: 'todos',
};

function startOfDayIso(date: string): string {
  return `${date}T00:00:00.000${AR_OFFSET}`;
}

function endOfDayIso(date: string): string {
  return `${date}T23:59:59.999${AR_OFFSET}`;
}

function toFilters(draft: DraftFilters): LprEventHistoryFilters {
  return {
    from: draft.from ? startOfDayIso(draft.from) : undefined,
    to: draft.to ? endOfDayIso(draft.to) : undefined,
    plate: draft.plate.trim() || undefined,
    direction: draft.direction === 'todos' ? undefined : draft.direction,
  };
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function shortId(value: string | null | undefined): string {
  return value ? value.slice(0, 8) : '—';
}

const DIRECTION_LABEL: Record<LprEventDirection, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
};

const QUALITY_LABEL: Record<LprEventHistoryItem['qualityStatus'], string> = {
  valid_high: 'Confianza alta',
  valid_low: 'Confianza media',
  invalid_format: 'Formato inválido',
  low_confidence: 'Confianza baja',
};

const STATUS_LABEL: Record<LprEventHistoryItem['status'], string> = {
  pending: 'Pendiente',
  registered: 'Registrado',
  dismissed: 'Descartado',
  suppressed_active_entry: 'Suprimido (ya adentro)',
  suppressed_pending_event: 'Suprimido (evento duplicado)',
  suppressed_recent_exit: 'Suprimido (egreso reciente)',
};

function plateOf(event: LprEventHistoryItem): string {
  return (
    event.plate ??
    event.displayPlate ??
    event.normalizedText ??
    event.rawText ??
    '—'
  );
}

function EvidenceImage({
  tenantId,
  event,
  variant,
}: {
  tenantId: string;
  event: LprEventHistoryItem;
  variant: 'thumb' | 'full';
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
    enabled: event.hasImage,
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });

  const className =
    variant === 'thumb' ? 'lpr-review-image' : 'event-history-detail-image';
  const emptyClassName =
    variant === 'thumb'
      ? 'lpr-review-image lpr-review-image-empty'
      : 'event-history-detail-image event-history-detail-image-empty';

  if (!event.hasImage) {
    return (
      <div className={emptyClassName}>
        <IconAlert size={22} />
        <span>Sin imagen</span>
      </div>
    );
  }

  if (imageQuery.isLoading) {
    return (
      <div className={emptyClassName}>
        <span>Cargando imagen…</span>
      </div>
    );
  }

  if (imageQuery.isError || !imageQuery.data) {
    return (
      <div className={emptyClassName}>
        <IconAlert size={22} />
        <span>No se pudo cargar</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={imageQuery.data}
      alt={`Patente detectada ${plateOf(event)}`}
    />
  );
}

function EventCard({
  tenantId,
  event,
  onOpen,
}: {
  tenantId: string;
  event: LprEventHistoryItem;
  onOpen: (event: LprEventHistoryItem) => void;
}) {
  return (
    <article className="pk-card lpr-review-card">
      <EvidenceImage tenantId={tenantId} event={event} variant="thumb" />

      <div className="lpr-review-card-body">
        <div className="lpr-review-card-head">
          <div>
            <p className="lpr-review-kicker">
              {DIRECTION_LABEL[event.direction]}
            </p>
            <h3>{plateOf(event)}</h3>
          </div>
          <Badge variant={event.direction === 'egreso' ? 'warn' : 'brand'}>
            {formatConfidence(event.confidence)}
          </Badge>
        </div>

        <div className="lpr-review-meta-grid">
          <div>
            <span>Fecha y hora</span>
            <strong>{formatDateTime(event.lastSeenAt)}</strong>
          </div>
          <div>
            <span>Confianza OCR</span>
            <strong>{QUALITY_LABEL[event.qualityStatus]}</strong>
          </div>
          <div>
            <span>Cámara</span>
            <strong>{event.cameraId}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>{STATUS_LABEL[event.status]}</strong>
          </div>
        </div>

        <div className="lpr-review-actions">
          <Button
            variant="secondary"
            size="sm"
            icon={<IconEye size={15} />}
            onClick={() => onOpen(event)}
          >
            Ver detalle
          </Button>
        </div>
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="event-history-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EventDetailModal({
  tenantId,
  event,
  onClose,
}: {
  tenantId: string;
  event: LprEventHistoryItem | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={event !== null}
      onClose={onClose}
      title={event ? `Evento · ${plateOf(event)}` : 'Evento'}
      width={720}
    >
      {event && (
        <div className="event-history-detail">
          <EvidenceImage tenantId={tenantId} event={event} variant="full" />

          <div className="event-history-detail-grid">
            <DetailRow label="Patente" value={plateOf(event)} />
            <DetailRow label="Tipo" value={DIRECTION_LABEL[event.direction]} />
            <DetailRow
              label="Fecha y hora"
              value={formatDateTime(event.lastSeenAt)}
            />
            <DetailRow
              label="Primera detección"
              value={formatDateTime(event.firstSeenAt)}
            />
            <DetailRow
              label="Confianza OCR"
              value={`${formatConfidence(event.confidence)} · ${QUALITY_LABEL[event.qualityStatus]}`}
            />
            <DetailRow
              label="Formato"
              value={`${event.formatType}${event.formatValid ? '' : ' (inválido)'}`}
            />
            <DetailRow label="Estado" value={STATUS_LABEL[event.status]} />
            <DetailRow label="Cámara" value={event.cameraId} />
            <DetailRow label="Ubicación" value={event.location} />
            <DetailRow label="Texto OCR crudo" value={event.rawText ?? '—'} />
            <DetailRow
              label="Texto normalizado"
              value={event.normalizedText ?? '—'}
            />
            <DetailRow
              label="Entrada asociada"
              value={shortId(event.entryId)}
            />
            <DetailRow
              label="Revisado por"
              value={shortId(event.reviewedByUserId)}
            />
            <DetailRow
              label="Revisado el"
              value={event.reviewedAt ? formatDateTime(event.reviewedAt) : '—'}
            />
            <DetailRow label="ID del evento" value={event.id} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export function EventHistoryPage() {
  const { sucursal, sucursalId } = useSucursal();
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<DraftFilters>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LprEventHistoryItem | null>(null);

  const filters = useMemo(() => toFilters(applied), [applied]);

  const query = useQuery({
    queryKey: ['lpr-event-history', sucursalId, filters, page],
    queryFn: () =>
      listLprEventHistory({
        tenantId: sucursalId,
        filters,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(sucursalId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const dateRangeInvalid =
    draft.from !== '' && draft.to !== '' && draft.from > draft.to;

  const events = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters =
    applied.from !== '' ||
    applied.to !== '' ||
    applied.plate.trim() !== '' ||
    applied.direction !== 'todos';

  function applyFilters() {
    if (dateRangeInvalid) return;
    setApplied(draft);
    setPage(1);
  }

  function clearFilters() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
    setPage(1);
  }

  return (
    <div>
      <SectionHeader
        title="Historial de eventos"
        subtitle={
          sucursal
            ? [sucursal.nombre, 'ingresos y egresos con evidencia visual']
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      />

      <form
        className="pk-card pk-card-pad event-history-filters"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
      >
        <div className="event-history-filters-grid">
          <Input
            label="Desde"
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
          <Input
            label="Hasta"
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
          <Input
            label="Patente"
            placeholder="Ej. AB123CD"
            value={draft.plate}
            onChange={(e) => setDraft((d) => ({ ...d, plate: e.target.value }))}
          />
          <div className="event-history-field">
            <label className="pk-label" htmlFor="event-history-direction">
              Tipo
            </label>
            <select
              id="event-history-direction"
              className="pk-input"
              value={draft.direction}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  direction: e.target.value as DirectionOption,
                }))
              }
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
        </div>

        <div className="event-history-filters-actions">
          {dateRangeInvalid && (
            <span className="event-history-filters-error">
              La fecha «Desde» no puede ser posterior a «Hasta».
            </span>
          )}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Limpiar
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            icon={<IconSearch size={15} />}
            loading={query.isFetching}
            disabled={dateRangeInvalid}
          >
            Buscar
          </Button>
        </div>
      </form>

      {query.isLoading ? (
        <div className="pk-card pk-card-pad lpr-review-loading">
          <IconClock size={18} />
          <span>Cargando eventos…</span>
        </div>
      ) : query.isError ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconAlert size={28} />}
            title="No se pudo cargar el historial"
            description="Probá ajustar los filtros o volver a intentarlo."
          />
        </div>
      ) : events.length === 0 ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconCar size={32} />}
            title="Sin eventos"
            description={
              hasActiveFilters
                ? 'Ningún evento coincide con los filtros aplicados.'
                : 'Todavía no hay eventos de cámara registrados para esta sucursal.'
            }
          />
        </div>
      ) : (
        <>
          <div className="event-history-summary">
            <span>
              {total} evento{total === 1 ? '' : 's'}
              {hasActiveFilters ? ' (filtrados)' : ''}
            </span>
          </div>

          <div className="lpr-review-grid">
            {events.map((event) => (
              <EventCard
                key={event.id}
                tenantId={sucursalId}
                event={event}
                onOpen={setSelected}
              />
            ))}
          </div>

          <div className="event-history-pagination">
            <Button
              variant="secondary"
              size="sm"
              icon={<IconChevronLeft size={15} />}
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span>
              Página {page} de {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconChevronRight size={15} />}
              disabled={page >= pageCount || query.isFetching}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}

      <EventDetailModal
        tenantId={sucursalId}
        event={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
