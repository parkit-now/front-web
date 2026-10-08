import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAuditEvents } from './audit';

const mock = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }));
vi.mock('../../../lib/api/client', () => ({ apiRequest: mock.request }));
vi.mock('../../../lib/supabase/session', () => ({ getSession: mock.session }));

beforeEach(() => {
  mock.request.mockReset();
  mock.session.mockReset();
  mock.session.mockResolvedValue({ access_token: 'token' });
});

describe('auditoría paginada', () => {
  it('cubre más de un mes y limita la carga a 5000 registros', async () => {
    mock.request.mockResolvedValue({
      items: Array.from({ length: 100 }, (_, index) => ({ id: String(index) })),
      total: 6_000,
    });
    const items = await listAuditEvents('playa-1', {
      from: '2026-10-01T00:00:00-03:00',
      to: '2026-11-01T00:00:00-03:00',
    });
    expect(items).toHaveLength(5_000);
    expect(mock.request).toHaveBeenCalledTimes(50);
    const first = mock.request.mock.calls[0]?.[0] as { path: string };
    const url = new URL(first.path, 'http://local');
    expect(url.searchParams.get('from')).toBe('2026-10-01T00:00:00-03:00');
    expect(url.searchParams.get('to')).toBe('2026-11-01T00:00:00-03:00');
    expect(url.searchParams.get('pageSize')).toBe('100');
  });
});
