import { describe, expect, it } from 'vitest';
import type { PaymentMethodBreakdown, TopPlate } from '../../services/metrics';
import {
  UNALLOCATED_LABEL,
  buildPieSlices,
  formatBucketLabel,
  formatMinutes,
  hasInconsistentUnallocated,
  sortTopPlates,
} from './transform';

function makeBreakdown(
  overrides: Partial<PaymentMethodBreakdown> = {},
): PaymentMethodBreakdown {
  return {
    total: 24100,
    allocated: 21700,
    unallocated: 2400,
    currency: 'ARS',
    from: '2026-08-07T16:00:00.000Z',
    to: '2026-08-10T16:00:00.000Z',
    methods: [
      { name: 'Transferencia', amount: 14200, count: 2, share: 0.5892 },
      { name: 'Efectivo', amount: 7500, count: 2, share: 0.3112 },
    ],
    ...overrides,
  };
}

function makePlate(overrides: Partial<TopPlate> = {}): TopPlate {
  return {
    plate: 'AB123CD',
    revenue: 1000,
    visits: 1,
    totalMinutes: 60,
    averageMinutes: 60,
    ...overrides,
  };
}

describe('formatBucketLabel', () => {
  it('rotula los buckets horarios con la hora', () => {
    expect(formatBucketLabel('2026-08-07T13', 'hour')).toBe('13h');
  });

  it('rotula los buckets diarios como día/mes', () => {
    expect(formatBucketLabel('2026-08-07', 'day')).toBe('07/08');
  });

  it('rotula la semana por su lunes, con el mismo formato que el día', () => {
    expect(formatBucketLabel('2026-08-03', 'week')).toBe('03/08');
  });

  it('rotula los buckets mensuales con el mes abreviado', () => {
    expect(formatBucketLabel('2026-08', 'month')).toBe('Ago');
  });

  it('no reinterpreta la clave como fecha local', () => {
    // Parsear '2026-01-01' con `new Date()` en un huso al oeste daría 31/12.
    expect(formatBucketLabel('2026-01-01', 'day')).toBe('01/01');
  });
});

describe('buildPieSlices', () => {
  it('agrega "sin detalle" como una porción más', () => {
    const slices = buildPieSlices(makeBreakdown());
    expect(slices).toHaveLength(3);
    expect(slices[2]).toMatchObject({
      name: UNALLOCATED_LABEL,
      amount: 2400,
      isUnallocated: true,
    });
  });

  it('las porciones suman exactamente el total', () => {
    const breakdown = makeBreakdown();
    const slices = buildPieSlices(breakdown);
    const sum = slices.reduce((acc, slice) => acc + slice.amount, 0);
    expect(sum).toBe(breakdown.total);
  });

  it('las proporciones suman 1', () => {
    const slices = buildPieSlices(makeBreakdown());
    const shareSum = slices.reduce((acc, slice) => acc + slice.share, 0);
    expect(shareSum).toBeCloseTo(1, 3);
  });

  it('omite la porción cuando toda la recaudación tiene desglose', () => {
    const slices = buildPieSlices(
      makeBreakdown({ unallocated: 0, allocated: 24100 }),
    );
    expect(slices).toHaveLength(2);
    expect(slices.some((slice) => slice.isUnallocated)).toBe(false);
  });

  it('no rompe cuando el total es 0', () => {
    const slices = buildPieSlices(
      makeBreakdown({ total: 0, allocated: 0, unallocated: 0, methods: [] }),
    );
    expect(slices).toEqual([]);
  });
});

describe('hasInconsistentUnallocated', () => {
  it('marca el caso en que los pagos superan lo cobrado', () => {
    expect(
      hasInconsistentUnallocated(makeBreakdown({ unallocated: -500 })),
    ).toBe(true);
  });

  it('no marca el caso normal', () => {
    expect(hasInconsistentUnallocated(makeBreakdown())).toBe(false);
  });
});

describe('sortTopPlates', () => {
  const items = [
    makePlate({ plate: 'AAA111', revenue: 100, visits: 9, totalMinutes: 30 }),
    makePlate({ plate: 'BBB222', revenue: 900, visits: 1, totalMinutes: 90 }),
    makePlate({ plate: 'CCC333', revenue: 500, visits: 5, totalMinutes: 600 }),
  ];

  it('ordena por recaudación descendente', () => {
    expect(sortTopPlates(items, 'revenue').map((p) => p.plate)).toEqual([
      'BBB222',
      'CCC333',
      'AAA111',
    ]);
  });

  it('ordena por cantidad de visitas', () => {
    expect(sortTopPlates(items, 'visits').map((p) => p.plate)).toEqual([
      'AAA111',
      'CCC333',
      'BBB222',
    ]);
  });

  it('ordena por tiempo total, no por promedio', () => {
    expect(sortTopPlates(items, 'duration').map((p) => p.plate)).toEqual([
      'CCC333',
      'BBB222',
      'AAA111',
    ]);
  });

  it('no muta el arreglo original', () => {
    const original = items.map((p) => p.plate);
    sortTopPlates(items, 'visits');
    expect(items.map((p) => p.plate)).toEqual(original);
  });
});

describe('formatMinutes', () => {
  it('muestra horas y minutos', () => {
    expect(formatMinutes(545)).toBe('9h 5m');
  });

  it('omite las horas cuando no llega a una', () => {
    expect(formatMinutes(45)).toBe('45m');
  });

  it('redondea los minutos fraccionarios', () => {
    expect(formatMinutes(59.6)).toBe('1h 0m');
  });
});
