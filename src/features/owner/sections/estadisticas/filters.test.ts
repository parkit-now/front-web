import { describe, expect, it } from 'vitest';
import { granularityIsTooFine, resolveRange, type RangeInput } from './filters';

// 15/08/2026 15:30 en Argentina.
const ANCHOR = new Date('2026-08-15T18:30:00Z').getTime();

function input(overrides: Partial<RangeInput> = {}): RangeInput {
  return {
    preset: 'custom',
    range: undefined,
    fromTime: '00:00',
    toTime: '23:59',
    ...overrides,
  };
}

describe('resolveRange con presets', () => {
  it('resuelve "7 días" contra el ancla, no contra el reloj', () => {
    const resolved = resolveRange(input({ preset: '7d' }), ANCHOR);
    expect(resolved).toMatchObject({
      ok: true,
      from: '2026-08-09T00:00:00-03:00',
      granularity: 'day',
    });
  });

  it('"hoy" agrupa por hora', () => {
    const resolved = resolveRange(input({ preset: 'hoy' }), ANCHOR);
    expect(resolved.ok && resolved.granularity).toBe('hour');
  });

  it('es estable: la misma ancla da siempre la misma ventana', () => {
    expect(resolveRange(input({ preset: '30d' }), ANCHOR)).toEqual(
      resolveRange(input({ preset: '30d' }), ANCHOR),
    );
  });
});

describe('resolveRange personalizado', () => {
  it('arma el caso del requerimiento: 7/8 13:00 a 18/8 03:00', () => {
    const resolved = resolveRange(
      input({
        range: { from: new Date(2026, 7, 7), to: new Date(2026, 7, 18) },
        fromTime: '13:00',
        toTime: '03:00',
      }),
      ANCHOR,
    );

    expect(resolved).toMatchObject({
      ok: true,
      from: '2026-08-07T13:00:00-03:00',
      to: '2026-08-18T03:00:00-03:00',
    });
  });

  it('un solo día elegido cubre ese día entre las dos horas', () => {
    const resolved = resolveRange(
      input({
        range: { from: new Date(2026, 7, 7) },
        fromTime: '08:00',
        toTime: '20:00',
      }),
      ANCHOR,
    );

    expect(resolved).toMatchObject({
      ok: true,
      from: '2026-08-07T08:00:00-03:00',
      to: '2026-08-07T20:00:00-03:00',
    });
  });

  it('pide elegir fechas si el rango está vacío', () => {
    expect(resolveRange(input(), ANCHOR)).toEqual({
      ok: false,
      reason: 'incomplete',
    });
  });

  it('rechaza el rango invertido antes de llamar al backend', () => {
    const resolved = resolveRange(
      input({
        range: { from: new Date(2026, 7, 7) },
        fromTime: '20:00',
        toTime: '08:00',
      }),
      ANCHOR,
    );

    expect(resolved).toEqual({ ok: false, reason: 'inverted' });
  });

  it('rechaza inicio y fin idénticos', () => {
    const resolved = resolveRange(
      input({
        range: { from: new Date(2026, 7, 7) },
        fromTime: '10:00',
        toTime: '10:00',
      }),
      ANCHOR,
    );

    expect(resolved).toEqual({ ok: false, reason: 'inverted' });
  });
});

describe('granularityIsTooFine', () => {
  it('detecta que dos meses por hora no entran en el tope de buckets', () => {
    const resolved = resolveRange(
      input({
        range: { from: new Date(2026, 0, 1), to: new Date(2026, 2, 2) },
      }),
      ANCHOR,
    );

    expect(granularityIsTooFine(resolved, 'hour')).toBe(true);
    expect(granularityIsTooFine(resolved, 'day')).toBe(false);
  });

  it('un rango inválido no dispara la advertencia', () => {
    expect(
      granularityIsTooFine({ ok: false, reason: 'incomplete' }, 'hour'),
    ).toBe(false);
  });
});
