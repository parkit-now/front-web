import { describe, expect, it } from 'vitest';
import {
  arDayKey,
  arMonthStartDayKey,
  estimateBuckets,
  exceedsBucketLimit,
  localDayKey,
  monthToDateRange,
  presetRange,
  shiftDayKey,
  suggestGranularity,
  toArOffsetIso,
} from './ar-datetime';

// 15/08/2026 15:30 en Argentina.
const NOW = new Date('2026-08-15T18:30:00Z');

describe('toArOffsetIso', () => {
  it('emite el offset argentino explícito', () => {
    expect(toArOffsetIso('2026-08-07', '13:00')).toBe(
      '2026-08-07T13:00:00-03:00',
    );
  });

  it('usa medianoche cuando no se pasa hora', () => {
    expect(toArOffsetIso('2026-08-07')).toBe('2026-08-07T00:00:00-03:00');
  });

  it('acepta una hora que ya trae segundos', () => {
    expect(toArOffsetIso('2026-08-07', '23:59:59')).toBe(
      '2026-08-07T23:59:59-03:00',
    );
  });

  it('produce un instante que el parser resuelve sin ambigüedad', () => {
    // 13:00 en Argentina son las 16:00 UTC.
    expect(new Date(toArOffsetIso('2026-08-07', '13:00')).toISOString()).toBe(
      '2026-08-07T16:00:00.000Z',
    );
  });
});

describe('arDayKey', () => {
  it('devuelve el día civil argentino, no el UTC', () => {
    // 16/08 02:00 UTC todavía es 15/08 a las 23:00 en Argentina.
    expect(arDayKey(new Date('2026-08-16T02:00:00Z'))).toBe('2026-08-15');
  });
});

describe('localDayKey', () => {
  it('lee el día del calendario local que eligió el usuario', () => {
    expect(localDayKey(new Date(2026, 7, 7))).toBe('2026-08-07');
  });
});

describe('shiftDayKey', () => {
  it('cruza el borde de mes hacia atrás', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('cruza el borde de año hacia adelante', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('presetRange', () => {
  it('"hoy" arranca a medianoche y agrupa por hora', () => {
    const range = presetRange('hoy', NOW);
    expect(range.from).toBe('2026-08-15T00:00:00-03:00');
    expect(range.granularity).toBe('hour');
  });

  it('"7d" incluye hoy, o sea que arranca 6 días antes', () => {
    const range = presetRange('7d', NOW);
    expect(range.from).toBe('2026-08-09T00:00:00-03:00');
    expect(range.granularity).toBe('day');
  });

  it('"30d" arranca 29 días antes', () => {
    expect(presetRange('30d', NOW).from).toBe('2026-07-17T00:00:00-03:00');
  });

  it('el extremo superior lleva offset explícito', () => {
    // `toISOString()` emite `Z`, que también es un offset explícito.
    expect(presetRange('7d', NOW).to).toBe('2026-08-15T18:30:00.000Z');
  });
});

describe('monthToDateRange', () => {
  it('cubre del día 1 al fin del día de hoy', () => {
    const range = monthToDateRange(NOW);
    expect(range.from).toBe('2026-08-01T00:00:00-03:00');
    expect(range.to).toBe('2026-08-15T23:59:59-03:00');
  });

  it('es estable durante todo el día, para no refetchear en loop', () => {
    const morning = new Date('2026-08-15T12:00:00Z');
    const evening = new Date('2026-08-15T21:00:00Z');
    expect(monthToDateRange(morning)).toEqual(monthToDateRange(evening));
  });
});

describe('arMonthStartDayKey', () => {
  it('devuelve el primer día del mes en curso', () => {
    expect(arMonthStartDayKey(NOW)).toBe('2026-08-01');
  });
});

describe('suggestGranularity', () => {
  const from = '2026-08-01T00:00:00-03:00';

  it('un solo día se agrupa por hora', () => {
    expect(suggestGranularity(from, '2026-08-02T00:00:00-03:00')).toBe('hour');
  });

  it('una semana se agrupa por día', () => {
    expect(suggestGranularity(from, '2026-08-08T00:00:00-03:00')).toBe('day');
  });

  it('medio año se agrupa por semana', () => {
    expect(suggestGranularity(from, '2027-01-01T00:00:00-03:00')).toBe('week');
  });

  it('varios años se agrupan por mes', () => {
    expect(suggestGranularity(from, '2030-01-01T00:00:00-03:00')).toBe('month');
  });

  it('nunca supera el tope de buckets del backend', () => {
    const to = '2030-01-01T00:00:00-03:00';
    expect(exceedsBucketLimit(from, to, suggestGranularity(from, to))).toBe(
      false,
    );
  });
});

describe('exceedsBucketLimit', () => {
  it('detecta un rango largo agrupado por hora', () => {
    // 60 días por hora son 1440 buckets: más que los 1000 que devuelve.
    expect(
      exceedsBucketLimit(
        '2026-01-01T00:00:00-03:00',
        '2026-03-02T00:00:00-03:00',
        'hour',
      ),
    ).toBe(true);
  });

  it('acepta el mismo rango agrupado por día', () => {
    expect(
      exceedsBucketLimit(
        '2026-01-01T00:00:00-03:00',
        '2026-03-02T00:00:00-03:00',
        'day',
      ),
    ).toBe(false);
  });

  it('un rango invertido no estima buckets', () => {
    expect(
      estimateBuckets(
        '2026-03-02T00:00:00-03:00',
        '2026-01-01T00:00:00-03:00',
        'day',
      ),
    ).toBe(0);
  });
});
