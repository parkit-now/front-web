import { describe, expect, it } from 'vitest';
import {
  ignoredPlateState,
  normalizeIgnoredPlate,
  whitelistFormError,
} from './whitelistUtils';

describe('Lista blanca', () => {
  it('normaliza y valida patentes y vigencia', () => {
    expect(normalizeIgnoredPlate(' iag-_574 ')).toBe('IAG574');
    expect(whitelistFormError({ plate: '' })).not.toBeNull();
    expect(
      whitelistFormError({
        plate: 'IAG574',
        validFrom: '2026-10-07',
        validUntil: '2026-10-06',
      }),
    ).not.toBeNull();
    expect(whitelistFormError({ plate: 'IAG574' })).toBeNull();
  });
  it('calcula estados por días completos de Argentina', () => {
    const rule = {
      plate: 'IAG574',
      active: true,
      validFrom: '2026-10-06',
      validUntil: '2026-10-06',
    };
    expect(ignoredPlateState(rule, Date.parse('2026-10-06T02:59:59Z'))).toBe(
      'Programada',
    );
    expect(ignoredPlateState(rule, Date.parse('2026-10-06T03:00:00Z'))).toBe(
      'Vigente',
    );
    expect(ignoredPlateState(rule, Date.parse('2026-10-07T02:59:59Z'))).toBe(
      'Vigente',
    );
    expect(ignoredPlateState(rule, Date.parse('2026-10-07T03:00:00Z'))).toBe(
      'Vencida',
    );
    expect(ignoredPlateState({ ...rule, active: false })).toBe('Desactivada');
  });
});
