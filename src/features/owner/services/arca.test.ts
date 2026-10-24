import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createArcaAccount,
  getArcaAccount,
  getArcaCsr,
  getArcaRenewalCsr,
  listArcaAccounts,
  listArcaReusableCertificates,
  reuseArcaCertificate,
  setArcaSalesPoint,
  unlinkArcaAccount,
  updateArcaAccount,
  uploadArcaCertificate,
  uploadArcaRenewalCertificate,
} from './arca';

const mock = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }));
vi.mock('../../../lib/api/client', () => ({ apiRequest: mock.request }));
vi.mock('../../../lib/supabase/session', () => ({ getSession: mock.session }));

beforeEach(() => {
  mock.request.mockReset();
  mock.request.mockResolvedValue({});
  mock.session.mockReset();
  mock.session.mockResolvedValue({ access_token: 'token' });
});

function lastCall() {
  return mock.request.mock.calls.at(-1)?.[0] as {
    method: string;
    path: string;
    body?: unknown;
    bearer: string;
  };
}

describe('servicio de ARCA', () => {
  it('lista las cuentas de la sede', async () => {
    await listArcaAccounts('playa 1');

    expect(lastCall()).toEqual({
      method: 'GET',
      path: '/tenants/playa%201/arca/accounts',
      bearer: 'token',
    });
  });

  it('sin cuenta explícita usa la principal; con cuenta, la de su id', async () => {
    await getArcaAccount('playa-1');
    expect(lastCall().path).toBe('/tenants/playa-1/arca/account');

    await getArcaAccount('playa-1', 'cuenta-2');
    expect(lastCall().path).toBe('/tenants/playa-1/arca/accounts/cuenta-2');
  });

  it('crea la principal en /account y la secundaria en /accounts', async () => {
    await createArcaAccount('playa-1', {
      cuit: '20123456786',
      iibb: '',
      role: 'primary',
    });
    expect(lastCall().path).toBe('/tenants/playa-1/arca/account');

    await createArcaAccount('playa-1', {
      cuit: '20123456786',
      iibb: '',
      role: 'secondary',
    });
    expect(lastCall()).toMatchObject({
      method: 'POST',
      path: '/tenants/playa-1/arca/accounts',
    });
  });

  it('cada paso del alta pega a su sub-recurso', async () => {
    await unlinkArcaAccount('p', 'c');
    expect(lastCall()).toMatchObject({
      method: 'DELETE',
      path: '/tenants/p/arca/accounts/c',
    });

    await updateArcaAccount('p', { razonSocial: 'APEX' }, 'c');
    expect(lastCall()).toMatchObject({
      method: 'PATCH',
      body: { razonSocial: 'APEX' },
    });

    const paths: string[] = [];
    for (const call of [
      () => getArcaCsr('p', 'c'),
      () => uploadArcaCertificate('p', { certificate: 'X' }, 'c'),
      () => listArcaReusableCertificates('p', 'c'),
      () => reuseArcaCertificate('p', { fromAccountId: 'o' }, 'c'),
      () =>
        setArcaSalesPoint(
          'p',
          { ptoVta: 3, inicioActividad: '2020-01-01' },
          'c',
        ),
      () => getArcaRenewalCsr('p', 'c'),
      () => uploadArcaRenewalCertificate('p', { certificate: 'X' }, 'c'),
    ]) {
      await call();
      paths.push(lastCall().path.replace('/tenants/p/arca/accounts/c', ''));
    }

    expect(paths).toEqual([
      '/csr',
      '/certificate',
      '/reusable-certificates',
      '/reuse-certificate',
      '/sales-point',
      '/renewal/csr',
      '/renewal/certificate',
    ]);
  });

  it('sin sesión no llama al backend', async () => {
    mock.session.mockResolvedValue(null);

    await expect(listArcaAccounts('playa-1')).rejects.toThrow(
      'No active session',
    );
    expect(mock.request).not.toHaveBeenCalled();
  });
});
