// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  click,
  mount,
  pageText,
  unmountAll,
  waitForText,
} from '../../../../test/dom';
import { IntegracionesPage } from './IntegracionesPage';

const mp = vi.hoisted(() => ({
  getMpAccount: vi.fn(),
  createMpAuthorizationUrl: vi.fn(),
  resyncMpPos: vi.fn(),
  unlinkMpAccount: vi.fn(),
}));
const arca = vi.hoisted(() => ({
  listArcaAccounts: vi.fn(),
  getArcaAccount: vi.fn(),
  unlinkArcaAccount: vi.fn(),
}));
const entities = vi.hoisted(() => ({ getEntityProfile: vi.fn() }));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../services/mercado-pago', () => mp);
vi.mock('../../services/arca', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...arca,
}));
vi.mock('../../services/entities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...entities,
}));

const NOW = new Date().toISOString();
const IN_DAYS = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const LOCATION = {
  formatted: 'Av. Corrientes 1234, CABA',
  streetName: 'Av. Corrientes',
  streetNumber: '1234',
  floor: null,
  cityName: 'Ciudad Autónoma de Buenos Aires',
  stateName: 'Ciudad Autónoma de Buenos Aires',
  postalCode: 'C1043',
  latitude: -34.6,
  longitude: -58.38,
  geocodedAt: NOW,
  geocodingSource: 'georef',
};

function mpAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mp-1',
    tenantId: 'tenant',
    mpUserId: '123',
    status: 'linked',
    linkedAt: NOW,
    accessTokenExpiresAt: IN_DAYS(120),
    refreshFailureCount: 0,
    posId: 'pos-1',
    qrImageUrl: 'https://mp.test/qr.png',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function arcaAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'arca-1',
    role: 'primary',
    cuit: '20123456781',
    certAlias: 'parkit',
    certExpiresAt: IN_DAYS(300),
    environment: 'produccion',
    status: 'linked',
    ptoVta: 3,
    razonSocial: 'APEX SRL',
    condicionIva: 'responsable_inscripto',
    iibb: '901-123456-7',
    inicioActividad: '2020-01-01',
    ivaRate: 21,
    fiscalDataEditable: true,
    ...overrides,
  };
}

describe('IntegracionesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sucursal.role = 'owner';
    mp.getMpAccount.mockResolvedValue(mpAccount());
    mp.createMpAuthorizationUrl.mockResolvedValue({
      authorizationUrl: 'https://auth.mercadopago.test',
    });
    mp.resyncMpPos.mockResolvedValue(mpAccount());
    mp.unlinkMpAccount.mockResolvedValue(undefined);
    arca.listArcaAccounts.mockResolvedValue([arcaAccount()]);
    arca.unlinkArcaAccount.mockResolvedValue(undefined);
    entities.getEntityProfile.mockResolvedValue({
      address: LOCATION.formatted,
      location: LOCATION,
    });
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('muestra Mercado Pago y ARCA vinculados', async () => {
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain('Integraciones');
    expect(pageText()).toContain('Mercado Pago');
    expect(pageText()).toContain('ARCA');
    expect(pageText()).toContain('Desvincular');
  });

  it('vincula Mercado Pago yendo a la autorización', async () => {
    mp.getMpAccount.mockRejectedValue(new ApiError(404, 'Not Found', null));
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
    });
    await mount(<IntegracionesPage />);

    await click('Vincular mi cuenta de Mercado Pago');

    expect(mp.createMpAuthorizationUrl).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('https://auth.mercadopago.test');
    vi.restoreAllMocks();
  });

  it('pide completar la dirección antes de vincular', async () => {
    mp.getMpAccount.mockRejectedValue(new ApiError(404, 'Not Found', null));
    entities.getEntityProfile.mockResolvedValue({
      address: null,
      location: { ...LOCATION, streetName: null, streetNumber: null },
    });
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain('Completá la dirección de tu estacionamiento');
  });

  it('avisa arriba de todo si se perdió la conexión', async () => {
    mp.getMpAccount.mockResolvedValue(mpAccount({ status: 'token_expired' }));
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain('Se perdió la conexión con Mercado Pago');
    await click('Re-vincular');
    expect(mp.createMpAuthorizationUrl).toHaveBeenCalled();
  });

  it('desvincula Mercado Pago después de confirmar', async () => {
    arca.listArcaAccounts.mockResolvedValue([]);
    await mount(<IntegracionesPage />);

    await click('Desvincular');
    expect(pageText()).toContain('¿Desvincular Mercado Pago?');
    const buttons = [...document.querySelectorAll('button')].filter(
      (button) => button.textContent?.trim() === 'Desvincular',
    );
    await click(buttons[buttons.length - 1]);

    expect(mp.unlinkMpAccount).toHaveBeenCalledWith('tenant');
    expect(pageText()).toContain('Desvinculamos tu cuenta de Mercado Pago.');
  });

  it('reintenta sincronizar el QR', async () => {
    mp.getMpAccount.mockResolvedValue(
      mpAccount({ posId: null, qrImageUrl: null }),
    );
    await mount(<IntegracionesPage />);

    await click('Reintentar sincronización');

    expect(mp.resyncMpPos).toHaveBeenCalledWith('tenant');
  });

  it('avisa cuando la vinculación de Mercado Pago está por vencer', async () => {
    mp.getMpAccount.mockResolvedValue(
      mpAccount({ accessTokenExpiresAt: IN_DAYS(5) }),
    );
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain('Tu vinculación vence en');
  });

  it('muestra ARCA pausado con el certificado vencido', async () => {
    arca.listArcaAccounts.mockResolvedValue([
      arcaAccount({ status: 'cert_expired' }),
    ]);
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain(
      'La facturación está pausada: el certificado venció',
    );
  });

  it('desvincula ARCA después de confirmar', async () => {
    mp.getMpAccount.mockRejectedValue(new ApiError(404, 'Not Found', null));
    await mount(<IntegracionesPage />);

    await click('Desvincular');
    expect(pageText()).toContain('¿Desvincular ARCA?');
    const buttons = [...document.querySelectorAll('button')].filter(
      (button) => button.textContent?.trim() === 'Desvincular',
    );
    await click(buttons[buttons.length - 1]);

    expect(arca.unlinkArcaAccount).toHaveBeenCalledWith('tenant', 'arca-1');
  });

  it('muestra ARCA a medio vincular', async () => {
    arca.listArcaAccounts.mockResolvedValue([
      arcaAccount({ status: 'pending_certificate', certExpiresAt: null }),
    ]);
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain('Cancelar');
  });

  it('avisa si no se pudo consultar Mercado Pago', async () => {
    mp.getMpAccount.mockRejectedValue(new ApiError(500, 'boom', null));
    await mount(<IntegracionesPage />);

    // useMpAccount reintenta los 5xx antes de darse por vencido.
    await waitForText('No pudimos consultar tu integración con Mercado Pago');
  });

  it('sin permisos de dueño queda en solo lectura', async () => {
    sucursal.role = 'operator';
    await mount(<IntegracionesPage />);

    expect(pageText()).toContain('Solo lectura');
  });
});
