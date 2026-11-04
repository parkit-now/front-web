import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLprDetectionEventImageUrl,
  listLprDetectionEvents,
  listRegisteredLprDetectionEventsForEntries,
  type LprDetectionEvent,
} from './lpr-events';

const mock = vi.hoisted(() => ({
  request: vi.fn(),
  session: vi.fn(),
  signed: vi.fn(),
}));
vi.mock('../../../lib/api/client', () => ({ apiRequest: mock.request }));
vi.mock('../../../lib/supabase/session', () => ({ getSession: mock.session }));
vi.mock('../../../lib/api/lpr-events', () => ({
  getLprDetectionEventImageSignedUrl: mock.signed,
}));

beforeEach(() => {
  mock.request.mockReset();
  mock.session.mockReset();
  mock.signed.mockReset();
  mock.session.mockResolvedValue({ access_token: 'token' });
});

function event(overrides: Partial<LprDetectionEvent>): LprDetectionEvent {
  return {
    id: 'e',
    status: 'registered',
    entryId: 'entry-1',
    lastSeenAt: '2026-10-07T10:00:00Z',
    imageDeletedAt: null,
    ...overrides,
  } as LprDetectionEvent;
}

function paths() {
  return mock.request.mock.calls.map(
    ([call]) => (call as { path: string }).path,
  );
}

describe('eventos LPR', () => {
  it('arma la query sólo con los filtros que llegan', async () => {
    mock.request.mockResolvedValue({ items: [], total: 0 });

    await listLprDetectionEvents({ tenantId: 'playa-1' });
    await listLprDetectionEvents({
      tenantId: 'playa-1',
      status: 'dismissed',
      page: 2,
      pageSize: 50,
      firstSeenFrom: 'a',
      firstSeenTo: 'b',
      entryIds: ['x', 'y'],
    });

    expect(paths()).toEqual([
      '/tenants/playa-1/lpr-events',
      '/tenants/playa-1/lpr-events?status=dismissed&page=2&pageSize=50&firstSeenFrom=a&firstSeenTo=b&entryIds=x%2Cy',
    ]);
  });

  it('sin estadías no consulta nada', async () => {
    await expect(
      listRegisteredLprDetectionEventsForEntries({
        tenantId: 'playa-1',
        entryIds: [],
      }),
    ).resolves.toEqual([]);
    expect(mock.request).not.toHaveBeenCalled();
  });

  it('usa el filtro por estadía cuando el backend lo soporta', async () => {
    mock.request.mockResolvedValue({
      items: [
        event({ id: 'ok' }),
        event({ id: 'otra', entryId: 'entry-9' }),
        event({ id: 'sin-foto', imageDeletedAt: '2026-10-08T00:00:00Z' }),
      ],
    });

    const result = await listRegisteredLprDetectionEventsForEntries({
      tenantId: 'playa-1',
      entryIds: ['entry-1'],
    });

    expect(result.map((item) => item.id)).toEqual(['ok']);
    expect(mock.request).toHaveBeenCalledOnce();
  });

  it('si el filtro falla recorre los cambios y se queda con el más reciente', async () => {
    mock.request
      .mockRejectedValueOnce(new Error('filtro no soportado'))
      .mockResolvedValueOnce({
        maxSeq: 10,
        items: [
          event({ id: 'viejo', lastSeenAt: '2026-10-07T09:00:00Z' }),
          event({ id: 'nuevo', lastSeenAt: '2026-10-07T11:00:00Z' }),
          event({ id: 'descartado', status: 'dismissed' }),
        ],
      });

    const result = await listRegisteredLprDetectionEventsForEntries({
      tenantId: 'playa-1',
      entryIds: ['entry-1'],
    });

    expect(result.map((item) => item.id)).toEqual(['nuevo']);
    expect(paths()[1]).toBe(
      '/tenants/playa-1/lpr-events/changes?afterSeq=0&limit=500',
    );
  });

  it('pagina los cambios mientras falten estadías', async () => {
    const fullPage = Array.from({ length: 500 }, (_, index) =>
      event({ id: `otro-${index}`, entryId: 'entry-x' }),
    );
    mock.request
      .mockResolvedValueOnce({ items: [event({ entryId: 'entry-x' })] })
      .mockResolvedValueOnce({ maxSeq: 500, items: fullPage })
      .mockResolvedValueOnce({
        maxSeq: 600,
        items: [event({ id: 'encontrado', entryId: 'entry-1' })],
      });

    const result = await listRegisteredLprDetectionEventsForEntries({
      tenantId: 'playa-1',
      entryIds: ['entry-1'],
    });

    expect(result.map((item) => item.id)).toEqual(['encontrado']);
    expect(paths()[2]).toContain('afterSeq=500');
  });

  it('devuelve la URL firmada de la imagen', async () => {
    mock.signed.mockResolvedValue({ url: 'https://storage.test/img.jpg' });

    await expect(
      getLprDetectionEventImageUrl({ tenantId: 'playa-1', eventId: 'e-1' }),
    ).resolves.toBe('https://storage.test/img.jpg');
    expect(mock.signed).toHaveBeenCalledWith({
      tenantId: 'playa-1',
      eventId: 'e-1',
      bearer: 'token',
    });
  });

  it('sin sesión falla antes de pedir', async () => {
    mock.session.mockResolvedValue(null);

    await expect(
      listLprDetectionEvents({ tenantId: 'playa-1' }),
    ).rejects.toThrow('No active session');
  });
});
