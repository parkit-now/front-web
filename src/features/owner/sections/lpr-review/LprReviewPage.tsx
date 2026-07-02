import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import {
  IconAlert,
  IconCar,
  IconClock,
  IconRefresh,
} from '../../../../shared/components/icons';
import { useSucursal } from '../../context/SucursalContext';
import {
  archiveLprDetectionEvent,
  getLprDetectionEventImageUrl,
  listLprDetectionEvents,
  type LprDetectionEvent,
} from '../../services/lpr-events';

const REVIEW_LIMIT = 50;

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
  archiving,
  onArchive,
}: {
  tenantId: string;
  event: LprDetectionEvent;
  archiving: boolean;
  onArchive: (event: LprDetectionEvent) => void;
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
            <strong>{shortId(event.reviewedByUserId)}</strong>
          </div>
          <div>
            <span>Evento</span>
            <strong>{shortId(event.id)}</strong>
          </div>
        </div>
        <div className="lpr-review-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onArchive(event)}
            loading={archiving}
          >
            Archivar
          </Button>
        </div>
      </div>
    </article>
  );
}

export function LprReviewPage() {
  const { sucursal, sucursalId } = useSucursal();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['lpr-events', sucursalId, 'dismissed', REVIEW_LIMIT],
    queryFn: () =>
      listLprDetectionEvents({
        tenantId: sucursalId,
        status: 'dismissed',
        limit: REVIEW_LIMIT,
      }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const events = query.data ?? [];
  const archiveMutation = useMutation({
    mutationFn: (event: LprDetectionEvent) =>
      archiveLprDetectionEvent({ tenantId: sucursalId, eventId: event.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['lpr-events', sucursalId, 'dismissed'],
      });
      showToast({ message: 'Patente archivada.', kind: 'success' });
    },
    onError: () => {
      showToast({
        message: 'No se pudo archivar la patente descartada.',
        kind: 'error',
      });
    },
  });

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
            description="No hay patentes descartadas por el operario para esta sucursal."
          />
        </div>
      ) : (
        <div className="lpr-review-grid">
          {events.map((event) => (
            <LprEvidenceCard
              key={event.id}
              tenantId={sucursalId}
              event={event}
              archiving={
                archiveMutation.isPending &&
                archiveMutation.variables?.id === event.id
              }
              onArchive={(next) => archiveMutation.mutate(next)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
