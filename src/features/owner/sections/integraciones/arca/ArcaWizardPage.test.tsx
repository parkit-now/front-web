// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../lib/api/client';
import {
  button,
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../../../../test/dom';
import type { ArcaAccount } from '../../../services/arca';
import { ArcaWizardPage } from './ArcaWizardPage';

const arca = vi.hoisted(() => ({
  listArcaAccounts: vi.fn(),
  getArcaAccount: vi.fn(),
  createArcaAccount: vi.fn(),
  updateArcaAccount: vi.fn(),
  getArcaCsr: vi.fn(),
  uploadArcaCertificate: vi.fn(),
  listArcaReusableCertificates: vi.fn(),
  reuseArcaCertificate: vi.fn(),
  setArcaSalesPoint: vi.fn(),
}));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../../services/arca', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...arca,
}));

const CUIT = '20123456786';
const CERT = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(520)}\n-----END CERTIFICATE-----`;

function account(overrides: Partial<ArcaAccount> = {}): ArcaAccount {
  return {
    id: 'arca-1',
    role: 'primary',
    cuit: CUIT,
    certAlias: 'parkit-apex',
    certExpiresAt: null,
    environment: 'produccion',
    status: 'pending_certificate',
    ptoVta: null,
    razonSocial: null,
    condicionIva: null,
    domicilioFiscal: null,
    iibb: '901-123456-7',
    inicioActividad: null,
    ivaRate: 21,
    fiscalDataEditable: true,
    ...overrides,
  };
}

function listing(...accounts: ArcaAccount[]) {
  arca.listArcaAccounts.mockResolvedValue(accounts);
}

describe('ArcaWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sucursal.role = 'owner';
    listing();
    arca.getArcaCsr.mockResolvedValue({
      alias: 'parkit-apex',
      csrPem:
        '-----BEGIN CERTIFICATE REQUEST-----\nX\n-----END CERTIFICATE REQUEST-----',
      fileName: 'parkit.csr',
    });
    arca.listArcaReusableCertificates.mockResolvedValue([]);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('paso 1: crea la cuenta con CUIT e Ingresos Brutos', async () => {
    arca.createArcaAccount.mockResolvedValue(account());
    await mount(<ArcaWizardPage />);

    expect(pageText()).toContain('Vincular ARCA · Primaria');
    await change(field('CUIT'), CUIT);
    await change(field('Ingresos Brutos'), '901-123456-7');
    await click('Continuar');

    expect(arca.createArcaAccount).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ cuit: CUIT }),
    );
  });

  it('paso 1: rechaza un CUIT inválido', async () => {
    await mount(<ArcaWizardPage />);

    await change(field('CUIT'), '20123456789');
    await click('Continuar');

    expect(arca.createArcaAccount).not.toHaveBeenCalled();
  });

  it('paso 2: recorre los sub-pasos y verifica el certificado', async () => {
    listing(account());
    arca.uploadArcaCertificate.mockResolvedValue({
      account: account({ status: 'pending_sales_point' }),
      padronFound: true,
    });
    await mount(<ArcaWizardPage />);

    expect(pageText()).toContain('Certificado ARCA');
    for (let step = 0; step < 3; step += 1) await click('Listo, sigo →');
    await change(field<HTMLTextAreaElement>('Certificado'), CERT);
    await click('Listo, sigo →');
    await click('Listo, sigo →');
    await click('Verificar');

    expect(arca.uploadArcaCertificate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ certificate: CERT }),
      'arca-1',
    );
  });

  it('paso 2: ofrece reutilizar un certificado de otra sede', async () => {
    listing(account());
    arca.listArcaReusableCertificates.mockResolvedValue([
      {
        accountId: 'otra',
        tenantId: 'otra-sede',
        tenantName: 'APEX Norte',
        cuit: CUIT,
        role: 'primary',
        ptoVta: 2,
      },
    ]);
    arca.reuseArcaCertificate.mockResolvedValue({
      account: account({ status: 'pending_sales_point' }),
      padronFound: false,
    });
    await mount(<ArcaWizardPage />);

    await click(/^Usar el certificado de APEX Norte/);

    expect(arca.reuseArcaCertificate).toHaveBeenCalled();
  });

  it('paso 2: pide los datos fiscales si no estaban en el padrón', async () => {
    listing(account({ status: 'pending_sales_point' }));
    arca.updateArcaAccount.mockResolvedValue(
      account({ status: 'pending_sales_point', razonSocial: 'APEX SRL' }),
    );
    await mount(<ArcaWizardPage />);

    await change(field('Razón social'), 'APEX SRL');
    await change(
      document.querySelector<HTMLSelectElement>('select')!,
      'responsable_inscripto',
    );
    await change(field('Domicilio fiscal'), 'Av. Corrientes 1234, CABA');
    await click('Continuar');
    if (pageText().includes('¿Los datos fiscales son correctos?')) {
      const confirm = [...document.querySelectorAll('button')].filter((b) =>
        /Confirmar|Sí/.test(b.textContent ?? ''),
      );
      await click(confirm[confirm.length - 1]);
    }

    expect(arca.updateArcaAccount).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ razonSocial: 'APEX SRL' }),
      'arca-1',
    );
  });

  it('paso 3: carga el punto de venta y termina', async () => {
    listing(
      account({
        status: 'pending_sales_point',
        razonSocial: 'APEX SRL',
        condicionIva: 'responsable_inscripto',
        domicilioFiscal: 'Av. Corrientes 1234',
      }),
    );
    arca.setArcaSalesPoint.mockResolvedValue(
      account({ status: 'linked', ptoVta: 3 }),
    );
    await mount(<ArcaWizardPage />, { path: '/arca?role=primary' });

    if (!pageText().includes('Número de punto de venta')) {
      await click('Continuar');
    }
    await change(field('Número de punto de venta'), '3');
    await change(field('Fecha de inicio de actividades'), '2020-01-01');
    await click('Verificar y vincular');

    expect(arca.setArcaSalesPoint).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ ptoVta: 3, inicioActividad: '2020-01-01' }),
      'arca-1',
    );
    expect(pageText()).toContain('ARCA quedó vinculada.');
  });

  it('muestra el error de ARCA al verificar el punto de venta', async () => {
    listing(
      account({
        status: 'pending_sales_point',
        razonSocial: 'APEX SRL',
        condicionIva: 'monotributo',
        domicilioFiscal: 'Av. Corrientes 1234',
      }),
    );
    arca.setArcaSalesPoint.mockRejectedValue(new ApiError(422, 'x', null));
    await mount(<ArcaWizardPage />);

    if (!pageText().includes('Número de punto de venta')) {
      await click('Continuar');
    }
    await change(field('Número de punto de venta'), '3');
    await change(field('Fecha de inicio de actividades'), '2020-01-01');
    await click('Verificar y vincular');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('con la cuenta vinculada muestra el cierre', async () => {
    listing(
      account({
        status: 'linked',
        ptoVta: 3,
        razonSocial: 'APEX SRL',
        condicionIva: 'responsable_inscripto',
        certExpiresAt: new Date(Date.now() + 300 * 86_400_000).toISOString(),
      }),
    );
    await mount(<ArcaWizardPage />);

    expect(button('Volver a integraciones')).toBeTruthy();
    expect(button('Configurar emisión')).toBeTruthy();
  });

  it('avisa el modo de prueba en homologación', async () => {
    listing(account({ environment: 'homologacion' }));
    await mount(<ArcaWizardPage />);

    expect(pageText()).toContain('Modo de prueba (homologación)');
  });

  it('sólo el dueño puede vincular', async () => {
    sucursal.role = 'operator';
    await mount(<ArcaWizardPage />);

    expect(pageText()).toContain('Sólo el dueño puede vincular ARCA');
  });
});
