// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import { EstadisticasPage } from './EstadisticasPage';

const metrics = vi.hoisted(() => ({
  getRevenueSeries: vi.fn(),
  getRevenueByPaymentMethod: vi.fn(),
  getVehicleCategoryBreakdown: vi.fn(),
  getTopPlates: vi.fn(),
  getMetricsSummary: vi.fn(),
}));
const cash = vi.hoisted(() => ({ listCashSessions: vi.fn() }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: 'owner' },
  }),
}));
vi.mock('../../services/metrics', () => metrics);
vi.mock('../../services/cash-sessions', () => cash);
vi.mock('../../services/entities', () => ({
  listPaymentMethods: () =>
    Promise.resolve([
      { id: 'efectivo', name: 'Efectivo' },
      { id: 'qr', name: 'Mercado Pago QR' },
    ]),
}));
vi.mock('../../services/vehicle-categories', () => ({
  listVehicleCategories: () =>
    Promise.resolve([
      { code: 'car', label: 'Auto', reservable: true, sortOrder: 1 },
      { code: 'motorcycle', label: 'Moto', reservable: true, sortOrder: 2 },
    ]),
}));

const NOW = new Date().toISOString();

function bucket(key: string, revenue: number, vehiclesIn: number) {
  return {
    key,
    from: `${key}T03:00:00.000Z`,
    to: `${key}T03:00:00.000Z`,
    revenue,
    reservationRevenue: 0,
    vehiclesIn,
    vehiclesOut: vehiclesIn,
  };
}

const projection = {
  value: 1000,
  openEntries: 2,
  historicalDays: 10,
  confidence: 'medium' as const,
};

function revenue(granularity = 'day') {
  const buckets = [
    bucket('2026-10-05', 12000, 8),
    bucket('2026-10-06', 18000, 11),
    bucket('2026-10-07', 9000, 5),
  ];
  return {
    buckets,
    currency: 'ARS',
    from: NOW,
    to: NOW,
    granularity,
    revenueSource: 'paymentTransactions',
    totals: bucket('total', 39000, 24),
    tz: 'America/Argentina/Buenos_Aires',
  };
}

describe('EstadisticasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    metrics.getRevenueSeries.mockImplementation(
      (input: { granularity?: string }) =>
        Promise.resolve(revenue(input.granularity)),
    );
    metrics.getRevenueByPaymentMethod.mockResolvedValue({
      allocated: 39000,
      unallocated: 0,
      total: 39000,
      currency: 'ARS',
      from: NOW,
      to: NOW,
      methods: [
        {
          name: 'Efectivo',
          amount: 25000,
          count: 15,
          share: 0.64,
          kind: 'payment',
        },
        {
          name: 'Mercado Pago QR',
          amount: 14000,
          count: 9,
          share: 0.36,
          kind: 'payment',
        },
      ],
    });
    metrics.getVehicleCategoryBreakdown.mockResolvedValue({
      categories: [
        { category: 'car', revenue: 30000, share: 0.77, stays: 18 },
        { category: null, revenue: 9000, share: 0.23, stays: 6 },
      ],
      currency: 'ARS',
      from: NOW,
      to: NOW,
      totalRevenue: 39000,
      totalStays: 24,
    });
    metrics.getTopPlates.mockResolvedValue({
      currency: 'ARS',
      from: NOW,
      to: NOW,
      orderBy: 'revenue',
      items: [
        {
          plate: 'AB123CD',
          revenue: 9000,
          visits: 4,
          totalMinutes: 600,
          averageMinutes: 150,
        },
        {
          plate: 'XYZ999',
          revenue: 4000,
          visits: 2,
          totalMinutes: 200,
          averageMinutes: 100,
        },
      ],
    });
    metrics.getMetricsSummary.mockResolvedValue({
      day: NOW.slice(0, 10),
      generatedAt: NOW,
      tz: 'America/Argentina/Buenos_Aires',
      occupancy: {
        capacity: 40,
        free: 30,
        occupied: 10,
        occupancyPct: 25,
        reservedHeld: 0,
      },
      today: {
        day: NOW.slice(0, 10),
        revenue: 9000,
        reservationRevenue: 0,
        vehiclesIn: 5,
        vehiclesOut: 4,
      },
      comparison: {
        previousDay: {
          day: '',
          revenue: 8000,
          reservationRevenue: 0,
          revenueDeltaPct: 12.5,
          vehiclesIn: 4,
          vehiclesInDeltaPct: 25,
          vehiclesOut: 4,
        },
        previousWeek: {
          day: '',
          revenue: 7000,
          reservationRevenue: 0,
          revenueDeltaPct: 28,
          vehiclesIn: 3,
          vehiclesInDeltaPct: 66,
          vehiclesOut: 3,
        },
      },
      alerts: { pendingLprEvents: 1 },
      projections: {
        todayWithOpenEntries: projection,
        todayHistoricalForecast: projection,
        monthWithOpenEntries: projection,
        monthHistoricalForecast: projection,
      },
    });
    cash.listCashSessions.mockResolvedValue([
      {
        id: 'caja-1',
        openedAt: '2026-10-07T11:00:00.000Z',
        closedAt: '2026-10-07T20:00:00.000Z',
        openingCash: 0,
        tenantId: 'tenant',
        updatedAt: NOW,
        version: 1,
        syncSeq: 1,
      },
    ]);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('muestra los totales, los métodos de pago y las patentes top', async () => {
    await mount(<EstadisticasPage />);

    expect(pageText()).toContain('Recaudación del período');
    expect(pageText()).toContain('Efectivo');
    expect(pageText()).toContain('AB123CD');
    expect(metrics.getRevenueSeries).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant', granularity: 'day' }),
    );
  });

  it('cambia el período y la serie mostrada', async () => {
    await mount(<EstadisticasPage />);

    await click('30 días');
    await click('Hoy');
    await click('Ingresos de vehículos');

    expect(pageText()).toContain('Ingresos de vehículos');
    expect(metrics.getRevenueSeries.mock.calls.length).toBeGreaterThan(2);
  });

  it('filtra por método de pago y categoría', async () => {
    await mount(<EstadisticasPage />);

    await change(field<HTMLSelectElement>('Método de pago'), 'Efectivo');
    await change(field<HTMLSelectElement>('Categoría de vehículo'), 'car');

    expect(metrics.getRevenueSeries).toHaveBeenLastCalledWith(
      expect.objectContaining({
        paymentMethod: 'Efectivo',
        vehicleCategory: 'car',
      }),
    );
  });

  it('agrupa por semana y por día de la semana', async () => {
    await mount(<EstadisticasPage />);

    await change(field<HTMLSelectElement>('Agrupar'), 'week');
    expect(metrics.getRevenueSeries).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: 'week' }),
    );

    await change(field<HTMLSelectElement>('Agrupar'), 'weekday');
    expect(
      document.querySelector('[aria-label="Cálculo por día de semana"]'),
    ).toBeTruthy();
  });

  it('pide elegir una caja y después la usa como recorte', async () => {
    await mount(<EstadisticasPage />);

    await click('Por caja');
    expect(pageText()).toContain('Elegí una caja');

    await change(field<HTMLSelectElement>('Caja'), 'caja-1');
    expect(metrics.getRevenueSeries).toHaveBeenLastCalledWith(
      expect.objectContaining({ cashSessionId: 'caja-1' }),
    );
  });

  it('pide un rango en el período personalizado', async () => {
    await mount(<EstadisticasPage />);

    await click('Personalizado');

    expect(pageText()).toContain('Elegí un rango de fechas');
  });

  it('avisa si no se pudieron cargar las estadísticas', async () => {
    metrics.getRevenueSeries.mockRejectedValue(new Error('offline'));
    await mount(<EstadisticasPage />);

    expect(pageText()).toContain('No se pudieron cargar las estadísticas');
  });

  it('avisa si el período no tiene datos', async () => {
    metrics.getRevenueSeries.mockResolvedValue({
      ...revenue(),
      buckets: [],
      totals: bucket('total', 0, 0),
    });
    await mount(<EstadisticasPage />);

    expect(pageText()).toContain('Sin datos en el período');
  });
});
