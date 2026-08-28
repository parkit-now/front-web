import { useQuery } from '@tanstack/react-query';
import { endOfDay, startOfDay } from 'date-fns';
import { useState } from 'react';
import { Pagination } from '../../../data-table/components/Pagination';
import '../../../data-table/data-table.css';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import {
  DateRangeFilter,
  type DateRange,
} from '../../../../shared/components/ui/DateRangeFilter';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import {
  IconAlert,
  IconCar,
  IconClock,
  IconRefresh,
} from '../../../../shared/components/icons';
import { useSucursal } from '../../context/SucursalContext';
import {
  getLprDetectionEventImageUrl,
  listLprDetectionEvents,
  type LprDetectionEvent,
} from '../../services/lpr-events';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const DEFAULT_PAGE_SIZE = 24;

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
  if (!value) return 'Sin usuario';
  return value.slice(0, 8);
}

/** A single selected day filters just that day; a range covers the whole
 * span from the start of the first day to the end of the last. */
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
      alt={`Patente detectada ${event.displayPlate ?? event.normalizedText ?? ''}`}
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
  const plate =
    event.displayPlate ?? event.normalizedText ?? event.rawText ?? '-';

  return (
    <article className="pk-card lpr-review-card">
      <EvidenceImage tenantId={tenantId} event={event} />

      <div className="lpr-review-card-body">
        <div className="lpr-review-card-head">
          <div>
            <p className="lpr-review-kicker">Patente descartada</p>
            <h3>{plate}</h3>
          </div>
          <Badge variant="warn">{formatConfidence(event.confidence)}</Badge>
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

export function LprReviewPage() {
  const { sucursal, sucursalId } = useSucursal();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  function handlePageIndexChange(next: number) {
    setPageIndex(next);
  }

  function handlePageSizeChange(next: number) {
    setPageSize(next);
    setPageIndex(0);
  }

  function handleDateRangeChange(next: DateRange | undefined) {
    setDateRange(next);
    setPageIndex(0);
  }

  const { firstSeenFrom, firstSeenTo } = dateRangeToQuery(dateRange);

  const query = useQuery({
    queryKey: [
      'lpr-events',
      sucursalId,
      'dismissed',
      pageIndex,
      pageSize,
      firstSeenFrom,
      firstSeenTo,
    ],
    queryFn: () =>
      listLprDetectionEvents({
        tenantId: sucursalId,
        status: 'dismissed',
        page: pageIndex + 1,
        pageSize,
        firstSeenFrom,
        firstSeenTo,
      }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const events = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <SectionHeader
        title="Patentes descartadas"
        subtitle={
          sucursal
            ? [sucursal.nombre, 'descartes del operario']
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<IconRefresh size={15} />}
            onClick={() => void query.refetch()}
            loading={query.isFetching}
          >
            Actualizar
          </Button>
        }
      />

      <div className="lpr-review-filters">
        <DateRangeFilter
          value={dateRange}
          onChange={handleDateRangeChange}
          placeholder="Fecha de detección"
        />
      </div>

      {query.isLoading ? (
        <div className="pk-card pk-card-pad lpr-review-loading">
          <IconClock size={18} />
          <span>Cargando descartes...</span>
        </div>
      ) : query.isError ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconAlert size={28} />}
            title="No se pudieron cargar las patentes descartadas"
            description="Probá actualizar la sección."
          />
        </div>
      ) : events.length === 0 ? (
        <div className="pk-card">
          <EmptyState
            icon={<IconCar size={32} />}
            title="Sin descartes LPR"
            description="No hay patentes descartadas por el operario para esta sucursal en el rango seleccionado."
          />
        </div>
      ) : (
        <>
          <div className="lpr-review-grid">
            {events.map((event) => (
              <LprEvidenceCard
                key={event.id}
                tenantId={sucursalId}
                event={event}
              />
            ))}
          </div>

          <Pagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={pageCount}
            totalRows={total}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            canPreviousPage={pageIndex > 0}
            canNextPage={pageIndex < pageCount - 1}
            onPageIndexChange={handlePageIndexChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}
