import { describe, expect, it } from 'vitest';
import type { ProjectionKpi } from '../../hooks/useKpis';
import {
  historicalProjectionSubtitle,
  openEntriesProjectionSubtitle,
} from './projectionCopy';

function projection(overrides: Partial<ProjectionKpi> = {}): ProjectionKpi {
  return {
    value: 1000,
    openEntries: 3,
    historicalDays: 6,
    confidence: 'high',
    ...overrides,
  };
}

describe('projection copy', () => {
  it('describes open-entry projections with the pending vehicle count', () => {
    expect(openEntriesProjectionSubtitle(projection({ openEntries: 4 }))).toBe(
      'Incluye 4 autos pendientes',
    );
  });

  it('describes historical projections with samples and confidence', () => {
    expect(
      historicalProjectionSubtitle(
        projection({ historicalDays: 3, confidence: 'medium' }),
      ),
    ).toBe('Basado en 3 días similares · confianza media');
  });

  it('does not pretend confidence when no history exists', () => {
    expect(
      historicalProjectionSubtitle(
        projection({ historicalDays: 0, confidence: 'low' }),
      ),
    ).toBe('Sin base histórica suficiente');
  });
});
