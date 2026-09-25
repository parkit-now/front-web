import { describe, expect, it } from 'vitest';
import type { ArcaAccount } from '../../../services/arca';
import {
  ARCA_CONSTANCIA_MAX_BYTES,
  resolveArcaWizardStep,
  validateArcaConstancia,
  validateArcaFiscalDataForm,
  validateArcaPtoVta,
  validateArcaStep1Form,
} from './wizard';

function makeAccount(overrides: Partial<ArcaAccount> = {}): ArcaAccount {
  return {
    id: '9f1c2b3a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
    certAlias: 'parkit1a2b3c4d',
    certExpiresAt: null,
    condicionIva: null,
    cuit: '20123456786',
    domicilioFiscal: null,
    environment: 'homologacion',
    fiscalDataEditable: true,
    hasSalesPointConstancia: false,
    iibb: null,
    inicioActividad: null,
    ivaRate: 21,
    linkedAt: null,
    ptoVta: null,
    razonSocial: null,
    status: 'pending_certificate',
    ...overrides,
  };
}

describe('resolveArcaWizardStep', () => {
  it('sin cuenta arranca en el paso 1', () => {
    expect(resolveArcaWizardStep(null)).toBe(1);
  });

  it('pending_certificate va al paso 2', () => {
    expect(
      resolveArcaWizardStep(makeAccount({ status: 'pending_certificate' })),
    ).toBe(2);
  });

  it('pending_sales_point sin condicionIva se queda en el paso 2 (datos fiscales)', () => {
    expect(
      resolveArcaWizardStep(
        makeAccount({ status: 'pending_sales_point', condicionIva: null }),
      ),
    ).toBe(2);
  });

  it('pending_sales_point con condicionIva avanza al paso 3', () => {
    expect(
      resolveArcaWizardStep(
        makeAccount({
          status: 'pending_sales_point',
          condicionIva: 'responsable_inscripto',
        }),
      ),
    ).toBe(3);
  });

  it('linked muestra la pantalla final', () => {
    expect(resolveArcaWizardStep(makeAccount({ status: 'linked' }))).toBe(
      'done',
    );
  });

  it('cert_expired también cae en la pantalla final (se resuelve desde la tarjeta)', () => {
    expect(resolveArcaWizardStep(makeAccount({ status: 'cert_expired' }))).toBe(
      'done',
    );
  });
});

describe('validateArcaStep1Form', () => {
  it('exige un CUIT válido', () => {
    expect(validateArcaStep1Form({ cuit: '20123456787', iibb: '' }).cuit).toBe(
      'El CUIT no es válido',
    );
  });

  it('no exige Ingresos Brutos', () => {
    expect(validateArcaStep1Form({ cuit: '20-12345678-6', iibb: '' })).toEqual(
      {},
    );
  });
});

describe('validateArcaFiscalDataForm', () => {
  const base = {
    razonSocial: 'Estacionamientos del Centro S.A.',
    condicionIva: 'responsable_inscripto' as const,
    domicilioFiscal: 'Av. Corrientes 1234, CABA',
    inicioActividad: '',
  };

  it('acepta el formulario mínimo, sin inicio de actividad', () => {
    expect(validateArcaFiscalDataForm(base)).toEqual({});
  });

  it('exige razón social, condición IVA y domicilio fiscal', () => {
    const errors = validateArcaFiscalDataForm({
      razonSocial: '',
      condicionIva: '',
      domicilioFiscal: '',
      inicioActividad: '',
    });
    expect(errors.razonSocial).toBeTruthy();
    expect(errors.condicionIva).toBeTruthy();
    expect(errors.domicilioFiscal).toBeTruthy();
  });
});

describe('validateArcaPtoVta', () => {
  it('acepta un número dentro de rango', () => {
    expect(validateArcaPtoVta('3')).toBeNull();
    expect(validateArcaPtoVta('99998')).toBeNull();
  });

  it('rechaza vacío, no numérico y fuera de rango', () => {
    expect(validateArcaPtoVta('')).toBeTruthy();
    expect(validateArcaPtoVta('abc')).toBeTruthy();
    expect(validateArcaPtoVta('0')).toBeTruthy();
    expect(validateArcaPtoVta('99999')).toBeTruthy();
  });
});

describe('validateArcaConstancia', () => {
  it('en homologación es opcional', () => {
    expect(
      validateArcaConstancia({ file: null, environment: 'homologacion' }),
    ).toBeNull();
  });

  it('en producción es obligatoria', () => {
    expect(
      validateArcaConstancia({ file: null, environment: 'produccion' }),
    ).toBeTruthy();
  });

  it('rechaza un archivo que no es PDF', () => {
    expect(
      validateArcaConstancia({
        file: { type: 'image/png', size: 100 },
        environment: 'produccion',
      }),
    ).toBeTruthy();
  });

  it('rechaza un PDF de más de 5 MB', () => {
    expect(
      validateArcaConstancia({
        file: {
          type: 'application/pdf',
          size: ARCA_CONSTANCIA_MAX_BYTES + 1,
        },
        environment: 'produccion',
      }),
    ).toBeTruthy();
  });

  it('acepta un PDF dentro del límite', () => {
    expect(
      validateArcaConstancia({
        file: { type: 'application/pdf', size: 1024 },
        environment: 'produccion',
      }),
    ).toBeNull();
  });
});
