import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';
import { issueConfirmedInvoiceBatch } from './invoices';

vi.mock('../../../lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/client')>()),
  apiRequest: vi.fn(),
}));
vi.mock('../../../lib/supabase/session', () => ({
  getSession: vi.fn(),
}));

const request = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({
    access_token: 'token',
  } as Awaited<ReturnType<typeof getSession>>);
});

describe('issueConfirmedInvoiceBatch', () => {
  it('envía cada importe confirmado y conserva el orden', async () => {
    request
      .mockResolvedValueOnce({ status: 'issued', errorCode: null })
      .mockResolvedValueOnce({ status: 'issued', errorCode: null });

    const results = await issueConfirmedInvoiceBatch('tenant', [
      { entryId: 'first', expectedAmount: 1250.25 },
      { entryId: 'second', expectedAmount: 200 },
    ]);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([options]) => options.path)).toEqual([
      '/tenants/tenant/entries/first/invoice',
      '/tenants/tenant/entries/second/invoice',
    ]);
    expect(request.mock.calls.map(([options]) => options.body)).toEqual([
      { receiverCuit: undefined, expectedAmount: 1250.25 },
      { receiverCuit: undefined, expectedAmount: 200 },
    ]);
    expect(results.map((result) => result.errorCode)).toEqual([null, null]);
  });

  it('no emite un monto cambiado y sigue con las demás facturas', async () => {
    request
      .mockRejectedValueOnce(
        new ApiError(409, 'Amount changed', {
          code: 'INVOICE_AMOUNT_CHANGED',
          title: 'Conflict',
          status: 409,
          detail: 'Amount changed',
          instance: '/invoice',
        }),
      )
      .mockResolvedValueOnce({ status: 'issued', errorCode: null });

    const results = await issueConfirmedInvoiceBatch('tenant', [
      { entryId: 'first', expectedAmount: 100 },
      { entryId: 'second', expectedAmount: 200 },
    ]);

    expect(results.map((result) => result.errorCode)).toEqual([
      'INVOICE_AMOUNT_CHANGED',
      null,
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('deja de intentar las restantes si ARCA no responde', async () => {
    request.mockResolvedValueOnce({
      status: 'error',
      errorCode: 'ARCA_UNAVAILABLE',
    });

    const results = await issueConfirmedInvoiceBatch('tenant', [
      { entryId: 'first', expectedAmount: 100 },
      { entryId: 'second', expectedAmount: 200 },
    ]);

    expect(request).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.errorCode)).toEqual([
      'ARCA_UNAVAILABLE',
      'ARCA_UNAVAILABLE',
    ]);
  });

  it('detiene el lote ante un error general de permisos', async () => {
    const error = new ApiError(403, 'Forbidden', {
      code: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'Forbidden',
      instance: '/invoice',
    });
    request.mockRejectedValueOnce(error);

    await expect(
      issueConfirmedInvoiceBatch('tenant', [
        { entryId: 'first', expectedAmount: 100 },
        { entryId: 'second', expectedAmount: 200 },
      ]),
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
