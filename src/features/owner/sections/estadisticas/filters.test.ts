import { describe, expect, it } from 'vitest';
import {
  availableGranularities,
  clampGranularity,
  granularityIsTooFine,
  hourGranularityAllowed,
  resolveRange,
  type RangeInput,
} from './filters';

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

describe('resolveRange por caja', () => {
  const id = '01920000-0000-7000-8000-000000000001';
  const openedAt = '2026-08-15T11:00:00.000Z';

  it('lleva la caja y sugiere agrupar por hora un turno normal', () => {
    const resolved = resolveRange(
      input({
        preset: 'caja',
        cashSession: { id, openedAt, closedAt: '2026-08-15T23:00:00.000Z' },
      }),
      ANCHOR,
    );

    expect(resolved).toMatchObject({
      ok: true,
      cashSessionId: id,
      granularity: 'hour',
    });
  });

  it('la ventana nominal de un turno abierto se corta en el ancla', () => {
    // No se manda al backend, pero decide si "por hora" está permitido.
    const resolved = resolveRange(
      input({ preset: 'caja', cashSession: { id, openedAt } }),
      ANCHOR,
    );

    expect(resolved).toMatchObject({
      ok: true,
      from: openedAt,
      to: new Date(ANCHOR).toISOString(),
      cashSessionId: id,
    });
  });

  it('un turno de más de 50 h no admite agrupar por hora', () => {
    const resolved = resolveRange(
      input({
        preset: 'caja',
        cashSession: { id, openedAt, closedAt: '2026-08-18T11:00:00.000Z' },
      }),
      ANCHOR,
    );

    expect(clampGranularity(resolved, 'hour')).toBe('day');
  });

  it('los otros modos no llevan caja', () => {
    const resolved = resolveRange(input({ preset: '7d' }), ANCHOR);
    expect(resolved.ok && resolved.cashSessionId).toBeUndefined();
  });

  it('pide elegir una caja si no hay turno seleccionado', () => {
    expect(resolveRange(input({ preset: 'caja' }), ANCHOR)).toEqual({
      ok: false,
      reason: 'no-session',
    });
  });
});

describe('hourGranularityAllowed', () => {
  function customRangeOf(hours: number) {
    // 15/08 00:00 más `hours`, expresado con los dos extremos del rango.
    const from = new Date(2026, 7, 15);
    const to = new Date(2026, 7, 15 + Math.floor(hours / 24));
    const restHours = hours % 24;
    return resolveRange(
      input({
        range: { from, to },
        fromTime: '00:00',
        toTime: `${String(restHours).padStart(2, '0')}:00`,
      }),
      ANCHOR,
    );
  }

  it('permite la hora justo en el límite de 50 h', () => {
    expect(hourGranularityAllowed(customRangeOf(49))).toBe(true);
    expect(hourGranularityAllowed(customRangeOf(50))).toBe(true);
  });

  it('la rechaza apenas se pasa', () => {
    expect(hourGranularityAllowed(customRangeOf(51))).toBe(false);
  });

  it('"hoy" siempre la permite y los presets largos no', () => {
    expect(
      hourGranularityAllowed(resolveRange(input({ preset: 'hoy' }), ANCHOR)),
    ).toBe(true);
    expect(
      hourGranularityAllowed(resolveRange(input({ preset: '7d' }), ANCHOR)),
    ).toBe(false);
    expect(
      hourGranularityAllowed(resolveRange(input({ preset: '30d' }), ANCHOR)),
    ).toBe(false);
  });

  it('un rango inválido no habilita la hora', () => {
    expect(hourGranularityAllowed({ ok: false, reason: 'incomplete' })).toBe(
      false,
    );
  });

  it('la saca de las opciones ofrecidas', () => {
    expect(availableGranularities(customRangeOf(51))).toEqual([
      'day',
      'week',
      'month',
    ]);
    expect(availableGranularities(customRangeOf(24))).toContain('hour');
  });

  it('degrada a día la elección manual que dejó de entrar', () => {
    expect(clampGranularity(customRangeOf(51), 'hour')).toBe('day');
    expect(clampGranularity(customRangeOf(24), 'hour')).toBe('hour');
  });

  it('no toca las granularidades más gruesas', () => {
    expect(clampGranularity(customRangeOf(51), 'week')).toBe('week');
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
