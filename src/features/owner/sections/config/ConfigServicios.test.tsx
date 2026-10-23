// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type { ServiceItem } from '../../services/services';
import { ConfigServicios } from './ConfigServicios';

const services = vi.hoisted(() => ({
  listServices: vi.fn(),
  updateService: vi.fn(),
  getReservationHours: vi.fn(),
  putReservationHours: vi.fn(),
}));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../services/services', () => services);
vi.mock('../../services/rates', () => ({
  listRates: () =>
    Promise.resolve([
      {
        id: 'rate-1',
        name: 'Por hora',
        hourPriceArs: 1500,
        fractionPriceArs: 125,
        mediaEstadiaPriceArs: 9000,
        stayPriceArs: 15000,
        isActive: true,
      },
      {
        id: 'rate-2',
        name: 'Premium',
        hourPriceArs: 3000,
        fractionPriceArs: 250,
        mediaEstadiaPriceArs: 0,
        stayPriceArs: 0,
        isActive: true,
      },
    ]),
}));
vi.mock('../../services/schedules', () => ({
  listSchedules: () =>
    Promise.resolve([
      { id: 's1', day: 'monday', openMinute: 480, closeMinute: 1200 },
    ]),
}));
vi.mock('../../services/entities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEntityProfile: () => Promise.resolve({ capacity: { total: 40 } }),
}));
vi.mock('../../services/mercado-pago', () => ({
  getMpAccount: () => Promise.resolve({ status: 'linked' }),
}));
vi.mock('../../services/vehicle-categories', () => ({
  listVehicleCategories: () =>
    Promise.resolve([
      { code: 'car', label: 'Auto', reservable: true, sortOrder: 1 },
      { code: 'suv', label: 'SUV', reservable: true, sortOrder: 2 },
      { code: 'motorcycle', label: 'Moto', reservable: true, sortOrder: 3 },
    ]),
}));
vi.mock('../../services/vehicle-types', () => ({
  listVehicleTypes: () =>
    Promise.resolve([
      { id: 'auto', name: 'Auto', category: 'car', accepted: true },
    ]),
}));

function service(overrides: Partial<ServiceItem> = {}): ServiceItem {
  return {
    code: 'ADVANCE_RESERVATION',
    enabled: false,
    reservableSpots: 8,
    reservationRateId: 'rate-1',
    reservationVehicleCategories: ['car', 'suv'],
    reservationHoursMode: 'opening',
    acceptanceMode: 'auto',
    approvalWindowMinutes: 15,
    freeCancelMinutes: 60,
    lateCancelRefundPct: 0,
    earlyArrivalMinutes: 15,
    graceMinutes: 30,
    earlyArrivalMaxMinutes: 60,
    readiness: { ready: true, missing: [] },
    upcomingPaidReservations: 0,
    ...overrides,
  };
}

function toggle() {
  return document.querySelector<HTMLElement>(
    '[aria-label="Aceptar reservas desde la app"]',
  )!;
}

describe('ConfigServicios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sucursal.role = 'owner';
    services.listServices.mockResolvedValue([service()]);
    services.getReservationHours.mockResolvedValue({
      mode: 'opening',
      ranges: [],
    });
    services.updateService.mockResolvedValue(service());
    services.putReservationHours.mockResolvedValue({
      mode: 'custom',
      ranges: [],
    });
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('muestra la configuración de reservas con el precio que ve el conductor', async () => {
    await mount(<ConfigServicios />);

    expect(pageText()).toContain('Servicios');
    expect(pageText()).toContain('Plazas reservables');
    expect(pageText()).toContain('Así lo ve el conductor');
    expect(pageText()).toContain('Mercado Pago vinculado.');
  });

  it('activa las reservas', async () => {
    await mount(<ConfigServicios />);

    await click(toggle());

    expect(services.updateService).toHaveBeenCalledWith(
      'tenant',
      'ADVANCE_RESERVATION',
      { enabled: true },
    );
    expect(pageText()).toContain('Reservas activadas.');
  });

  it('marca los requisitos que faltan si el backend rechaza activar', async () => {
    services.updateService.mockRejectedValue(
      new ApiError(422, 'Unprocessable', {
        code: 'RESERVATION_NOT_READY',
        missing: ['rate', 'spots'],
      } as never),
    );
    await mount(<ConfigServicios />);

    await click(toggle());

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('pide confirmación para desactivar', async () => {
    services.listServices.mockResolvedValue([service({ enabled: true })]);
    await mount(<ConfigServicios />);

    await click(toggle());
    expect(pageText()).toContain('¿Desactivar reservas?');
    await click('Desactivar');

    expect(services.updateService).toHaveBeenCalledWith(
      'tenant',
      'ADVANCE_RESERVATION',
      { enabled: false },
    );
  });

  it('guarda plazas, tarifa y modo de aceptación', async () => {
    await mount(<ConfigServicios />);

    await change(field('Plazas reservables'), '12');
    await change(
      document.querySelector<HTMLSelectElement>('#reservation-rate')!,
      'rate-2',
    );
    await change(
      field<HTMLSelectElement>('Cómo se confirman las reservas'),
      'manual',
    );
    await click('Guardar');

    expect(services.updateService).toHaveBeenCalledWith(
      'tenant',
      'ADVANCE_RESERVATION',
      expect.objectContaining({
        reservableSpots: 12,
        reservationRateId: 'rate-2',
        acceptanceMode: 'manual',
      }),
    );
    expect(pageText()).toContain('Configuración de reservas guardada.');
  });

  it('cambia las categorías que pueden reservar', async () => {
    await mount(<ConfigServicios />);

    const moto = [
      ...document.querySelectorAll<HTMLElement>('[role="checkbox"]'),
    ].find((element) => element.textContent?.includes('Moto'))!;
    await click(moto);
    await click('Guardar');

    expect(services.updateService).toHaveBeenCalledWith(
      'tenant',
      'ADVANCE_RESERVATION',
      expect.objectContaining({
        reservationVehicleCategories: expect.arrayContaining([
          'car',
          'suv',
          'motorcycle',
        ]) as unknown,
      }),
    );
  });

  it('descarta los cambios', async () => {
    await mount(<ConfigServicios />);

    await change(field('Plazas reservables'), '30');
    await click('Descartar');

    expect(field('Plazas reservables').value).toBe('8');
  });

  it('pide franjas al pasar a horario personalizado', async () => {
    await mount(<ConfigServicios />);

    const custom = document.querySelector<HTMLElement>(
      '[data-testid="reservation-hours-custom"]',
    )!;
    await click(custom.querySelector('input') ?? custom);
    await click('Guardar');

    expect(pageText()).toContain(
      'Cargá al menos una franja para el horario personalizado.',
    );
    expect(services.putReservationHours).not.toHaveBeenCalled();
  });

  it('muestra el error de guardado', async () => {
    services.updateService.mockRejectedValue(new ApiError(500, 'boom', null));
    await mount(<ConfigServicios />);

    await change(field('Plazas reservables'), '9');
    await click('Guardar');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('sin permisos de dueño no deja editar', async () => {
    sucursal.role = 'operator';
    await mount(<ConfigServicios />);

    expect(pageText()).not.toContain('Descartar');
  });
});
