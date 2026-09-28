import type { ProjectionKpi } from '../../hooks/useKpis';

export function projectionConfidenceText(
  confidence: ProjectionKpi['confidence'],
): string {
  if (confidence === 'high') return 'confianza alta';
  if (confidence === 'medium') return 'confianza media';
  return 'confianza baja';
}

export function openEntriesProjectionSubtitle(
  projection: ProjectionKpi,
): string {
  return `Incluye ${projection.openEntries} autos pendientes`;
}

export function historicalProjectionSubtitle(
  projection: ProjectionKpi,
): string {
  if (projection.historicalDays <= 0) {
    return 'Sin base histórica suficiente';
  }
  return `Basado en ${projection.historicalDays} días similares · ${projectionConfidenceText(projection.confidence)}`;
}
