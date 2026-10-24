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
import type {
  OwnerReservation,
  ReservationStatus,
} from '../../services/reservations';
import { ReservasPage } from './ReservasPage';

const api = vi.hoisted(() => ({
  listReservations: vi.fn(),
  listAllReservations: vi.fn(),
  getReservation: vi.fn(),
  acceptReservation: vi.fn(),
  rejectReservation: vi.fn(),
  cancelReservation: vi.fn(),
  retryReservationRefund: vi.fn(),
}));
const services = vi.hoisted(() => ({ listServices: vi.fn() }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: 'owner' },
  }),
}));
vi.mock('../../services/reservations', () => ({
  ...api,
  RESERVATIONS_PAGE_SIZE: 100,
}));
vi.mock('../../services/services', () => services);
vi.mock('../../services/metrics', () => ({
  getMetricsSummary: () =>
    Promise.resolve({ occupancy: { free: 7, occupied: 3 } }),
}));

const FUTURE = Date.now() + 2 * 86_400_000;
const iso = (offsetMinutes: number) =>
  new Date(FUTURE + offsetMinutes * 60_000).toISOString();

function reservation(
  overrides: Partial<OwnerReservation> = {},
): OwnerReservation {
  return {
    id: 'r-1',
    code: 'R-AAA111',
    status: 'confirmed',
    vehiclePlate: 'AB123CD',
    vehicleCategory: 'car',
    driverName: 'Ana Pérez',
    entryAt: iso(0),
    exitAt: iso(120),
    createdAt: iso(-600),
    paidAt: iso(-590),
    approvalDeadlineAt: null,
    holdExpiresAt: null,
    cancelledAt: null,
    cancelledBy: null,
    reason: null,
    rateName: 'Auto',
    totalArs: 4500,
    refundStatus: 'none',
    refundedAmountArs: null,
    refundError: null,
    stay: null,
    policy: {
      acceptanceMode: 'manual',
      approvalWindowMinutes: 30,
      earlyArrivalMaxMinutes: 30,
      earlyArrivalMinutes: 15,
      freeCancelMinutes: 60,
      graceMinutes: 30,
      lateCancelRefundPct: 0,
    },
    ...overrides,
  };
}

const pending = reservation({
  id: 'r-pend',
  code: 'R-PEND01',
  status: 'pending_approval',
  vehiclePlate: 'PE123ND',
  approvalDeadlineAt: new Date(Date.now() + 20 * 60_000).toISOString(),
});
const confirmed = reservation({
  id: 'r-conf',
  code: 'R-CONF01',
  vehiclePlate: 'CO123NF',
});
const failedRefund = reservation({
  id: 'r-fail',
  code: 'R-FAIL01',
  status: 'cancelled',
  vehiclePlate: 'FA123IL',
  cancelledAt: iso(-60),
  cancelledBy: 'owner',
  refundStatus: 'failed',
  refundError: 'insufficient_funds',
});

let board: OwnerReservation[];

describe('ReservasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    board = [pending, confirmed, failedRefund];
    api.listAllReservations.mockImplementation(
      (_tenant: string, params: { status?: ReservationStatus }) =>
        Promise.resolve(
          params.status
            ? board.filter((r) => r.status === params.status)
            : board,
        ),
    );
    api.listReservations.mockImplementation(
      (_tenant: string, params: { status?: ReservationStatus }) => {
        const items = board.filter((r) => r.status === params.status);
        return Promise.resolve({
          items,
          total: items.length,
          page: 1,
          pageSize: 100,
        });
      },
    );
    api.getReservation.mockImplementation((_tenant: string, id: string) =>
      Promise.resolve({
        ...board.find((r) => r.id === id),
        payments: [],
        refundAttempts: 1,
        refundRequestedArs: 4500,
        refundRequestedAt: null,
      }),
    );
    api.acceptReservation.mockResolvedValue(pending);
    api.rejectReservation.mockResolvedValue(pending);
    api.cancelReservation.mockResolvedValue(confirmed);
    api.retryReservationRefund.mockResolvedValue({
      ...failedRefund,
      refundStatus: 'pending',
    });
    services.listServices.mockResolvedValue([
      { code: 'ADVANCE_RESERVATION', enabled: true, acceptanceMode: 'manual' },
    ]);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('abre en las reservas por aceptar con los KPIs del día', async () => {
    await mount(<ReservasPage />);

    expect(pageText()).toContain('Reservas');
    expect(pageText()).toContain('Por aceptar');
    expect(pageText()).toContain('PE123ND');
    expect(pageText()).toContain('Libres ahora');
    expect(pageText()).toContain('Tenés 1 reserva por aceptar.');
  });

  it('acepta una reserva pendiente', async () => {
    await mount(<ReservasPage />);

    await click('Aceptar');

    expect(api.acceptReservation).toHaveBeenCalledWith('tenant', 'r-pend');
    expect(pageText()).toContain('Aceptaste la reserva de PE123ND');
  });

  it('rechaza una reserva con motivo', async () => {
    await mount(<ReservasPage />);

    await click('Rechazar');
    await change(
      field<HTMLTextAreaElement>('Motivo (lo ve el conductor)'),
      'Playa completa',
    );
    await click('Rechazar y reembolsar');

    expect(api.rejectReservation).toHaveBeenCalledWith(
      'tenant',
      'r-pend',
      'Playa completa',
    );
    expect(pageText()).toContain('Rechazaste la reserva de PE123ND');
  });

  it('muestra el error del rechazo en el diálogo', async () => {
    api.rejectReservation.mockRejectedValue(new ApiError(409, 'x', null));
    await mount(<ReservasPage />);

    await click('Rechazar');
    await change(
      field<HTMLTextAreaElement>('Motivo (lo ve el conductor)'),
      'Sin lugar',
    );
    await click('Rechazar y reembolsar');

    expect(pageText()).toContain('Rechazar y reembolsar');
  });

  it('cancela una reserva confirmada desde su detalle', async () => {
    await mount(<ReservasPage />);

    await click(/^Próximas/);
    const row = [...document.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent?.includes('CO123NF'),
    ) as HTMLElement;
    await click(row);
    expect(pageText()).toContain('Reserva R-CONF01');
    await click('Cancelar y reembolsar');
    await change(
      field<HTMLTextAreaElement>('Motivo de cancelación (lo ve el conductor)'),
      'Corte de luz',
    );
    const buttons = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Cancelar y reembolsar',
    );
    await click(buttons[buttons.length - 1]);

    expect(api.cancelReservation).toHaveBeenCalledWith(
      'tenant',
      'r-conf',
      'Corte de luz',
    );
  });

  it('reintenta un reembolso fallido', async () => {
    await mount(<ReservasPage />);

    await click('Reintentar');

    expect(api.retryReservationRefund).toHaveBeenCalledWith('tenant', 'r-fail');
    expect(pageText()).toContain('Reintentamos el reembolso.');
  });

  it('avisa cuando el reembolso vuelve a fallar', async () => {
    api.retryReservationRefund.mockResolvedValue(failedRefund);
    await mount(<ReservasPage />);

    await click('Reintentar');

    expect(pageText()).toContain('El reembolso volvió a fallar.');
  });

  it('muestra el historial', async () => {
    await mount(<ReservasPage />);

    await click(/^Historial/);

    expect(pageText()).toContain('FA123IL');
  });

  it('avisa si las reservas están desactivadas', async () => {
    board = [];
    services.listServices.mockResolvedValue([
      { code: 'ADVANCE_RESERVATION', enabled: false, acceptanceMode: 'auto' },
    ]);
    await mount(<ReservasPage />);

    expect(pageText()).toContain('Las reservas están desactivadas.');
  });

  it('avisa si no se pudieron cargar', async () => {
    api.listAllReservations.mockRejectedValue(new Error('offline'));
    await mount(<ReservasPage />);

    expect(document.querySelector('.pk-alert, [role="alert"]')).toBeTruthy();
  });
});
