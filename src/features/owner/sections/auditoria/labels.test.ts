import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  auditActionOptions,
  auditActorLabel,
} from './labels';

describe('auditActionLabel', () => {
  it('traduce una acción del catálogo', () => {
    expect(auditActionLabel('entity.profile_updated')).toBe(
      'editó el perfil del estacionamiento',
    );
  });

  it('muestra el código crudo si el backend suma una acción nueva', () => {
    expect(auditActionLabel('entry.closed')).toBe('entry.closed');
  });
});

describe('auditActorLabel', () => {
  it('nombra al sistema cuando no hay persona detrás', () => {
    expect(auditActorLabel(null)).toBe('Sistema');
  });

  it('respeta el nombre del actor', () => {
    expect(auditActorLabel('Ana Gómez')).toBe('Ana Gómez');
  });
});

describe('auditActionOptions', () => {
  it('cubre todo el catálogo del contrato', () => {
    expect(auditActionOptions()).toHaveLength(
      Object.keys(AUDIT_ACTION_LABELS).length,
    );
  });

  it('viene ordenado alfabéticamente por etiqueta', () => {
    const labels = auditActionOptions().map((option) => option.label);
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, 'es')),
    );
  });
});
