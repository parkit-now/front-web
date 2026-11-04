import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRate,
  deleteRate,
  listOpenEntriesByRate,
  listRates,
  updateRate,
} from './rates';
import {
  acceptReservation,
  cancelReservation,
  getReservation,
  listAllReservations,
  listReservations,
  rejectReservation,
  retryReservationRefund,
} from './reservations';

const mock = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }));
vi.mock('../../../lib/api/client', () => ({ apiRequest: mock.request }));
vi.mock('../../../lib/supabase/session', () => ({ getSession: mock.session }));

beforeEach(() => {
  mock.request.mockReset();
  mock.request.mockResolvedValue({});
  mock.session.mockReset();
  mock.session.mockResolvedValue({ access_token: 'token' });
});

function requests() {
  return mock.request.mock.calls.map(([call]) => {
    const { method, path } = call as { method: string; path: string };
    return `${method} ${path}`;
  });
}

describe('servicio de tarifas', () => {
  it('lista, crea, edita con versión y borra', async () => {
    await listRates('t');
    await listRates('t', true);
    await createRate('t', { id: 'r', name: 'Auto' } as never);
    await listOpenEntriesByRate('t');
    await updateRate('t', 'r', 3, { name: 'Auto 2' });
    await deleteRate('t', 'r', 4);

    expect(requests()).toEqual([
      'GET /tenants/t/rates',
      'GET /tenants/t/rates?includeInactive=true',
      'POST /tenants/t/rates',
      'GET /tenants/t/rates/open-entries',
      'PATCH /tenants/t/rates/r?expectedVersion=3',
      'DELETE /tenants/t/rates/r?expectedVersion=4',
    ]);
  });
});

describe('servicio de reservas', () => {
  it('filtra sólo con los parámetros cargados', async () => {
    await listReservations('t');
    await listReservations('t', {
      status: 'confirmed',
      q: '',
      page: 2,
      pageSize: 50,
    });

    expect(requests()).toEqual([
      'GET /tenants/t/reservations',
      'GET /tenants/t/reservations?status=confirmed&page=2&pageSize=50',
    ]);
  });

  it('trae todas las páginas hasta el total', async () => {
    mock.request
      .mockResolvedValueOnce({ items: [{ id: '1' }, { id: '2' }], total: 3 })
      .mockResolvedValueOnce({ items: [{ id: '3' }], total: 3 });

    const all = await listAllReservations('t', { status: 'confirmed' });

    expect(all.map((item) => item.id)).toEqual(['1', '2', '3']);
    expect(requests()[1]).toContain('page=2');
  });

  it('corta si una página vuelve vacía o se llega al máximo', async () => {
    mock.request.mockResolvedValue({ items: [], total: 10 });
    expect(await listAllReservations('t', {})).toEqual([]);

    mock.request.mockReset();
    mock.request.mockResolvedValue({ items: [{ id: 'x' }], total: 100 });
    expect(await listAllReservations('t', {}, 2)).toHaveLength(2);
  });

  it('cada acción pega a su endpoint', async () => {
    await getReservation('t', 'r 1');
    await acceptReservation('t', 'r');
    await rejectReservation('t', 'r', 'sin lugar');
    await cancelReservation('t', 'r', 'corte de luz');
    await retryReservationRefund('t', 'r');

    expect(requests()).toEqual([
      'GET /tenants/t/reservations/r%201',
      'POST /tenants/t/reservations/r/accept',
      'POST /tenants/t/reservations/r/reject',
      'POST /tenants/t/reservations/r/cancel',
      'POST /tenants/t/reservations/r/refund/retry',
    ]);
  });

  it('sin sesión falla', async () => {
    mock.session.mockResolvedValue(null);

    await expect(listRates('t')).rejects.toThrow('No active session');
    await expect(listReservations('t')).rejects.toThrow('No active session');
  });
});
