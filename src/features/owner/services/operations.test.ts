import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';
import { correctEntry } from './operations';

vi.mock('../../../lib/api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('../../../lib/supabase/session', () => ({ getSession: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ access_token: 'token' } as never);
  vi.mocked(apiRequest).mockResolvedValue({ id: 'entry', version: 5 });
});

it('corrige estado de factura con version y contrato OpenAPI', async () => {
  await correctEntry(
    'tenant/a',
    { id: 'entry/b', version: 4 },
    {
      invoicePending: true,
    },
  );
  expect(apiRequest).toHaveBeenCalledWith({
    method: 'PATCH',
    path: '/tenants/tenant%2Fa/entries/entry%2Fb/correction?expectedVersion=4',
    body: { invoicePending: true },
    bearer: 'token',
  });
});

it('permite borrar notas enviando texto vacio', async () => {
  await correctEntry('tenant', { id: 'entry', version: 2 }, { notes: '' });
  expect(apiRequest).toHaveBeenCalledWith(
    expect.objectContaining({ body: { notes: '' } }),
  );
});
