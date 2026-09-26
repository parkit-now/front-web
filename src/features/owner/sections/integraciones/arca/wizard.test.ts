import { describe, expect, it } from 'vitest';
import type { ArcaAccount } from '../../../services/arca';
import {
  ARCA_CONSTANCIA_MAX_BYTES,
  resolveArcaStep1ViewMode,
  resolveArcaStep2ViewMode,
  resolveArcaWizardStep,
  resolveClickableArcaWizardSteps,
  validateArcaConstancia,
  validateArcaFiscalDataForm,
  validateArcaPtoVta,
  validateArcaStep1Form,
  validatePastedCertificate,
  describeInvoiceLetter,
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

describe('resolveClickableArcaWizardSteps', () => {
  it('en el paso 1, sólo el 1 es clickeable', () => {
    expect(resolveClickableArcaWizardSteps(1)).toEqual([1]);
  });

  it('en el paso 2, el 1 y el 2 (el actual incluido)', () => {
    expect(resolveClickableArcaWizardSteps(2)).toEqual([1, 2]);
  });

  it('en el paso 3, los tres', () => {
    expect(resolveClickableArcaWizardSteps(3)).toEqual([1, 2, 3]);
  });

  it('con la cuenta linked (wizard terminado), ninguno', () => {
    expect(resolveClickableArcaWizardSteps('done')).toEqual([]);
  });
});

describe('resolveArcaStep1ViewMode', () => {
  it('es el formulario cuando el wizard está parado en el paso 1', () => {
    expect(resolveArcaStep1ViewMode(1)).toBe('form');
  });

  it('es el resumen de sólo lectura si ya se avanzó', () => {
    expect(resolveArcaStep1ViewMode(2)).toBe('recap');
    expect(resolveArcaStep1ViewMode(3)).toBe('recap');
    expect(resolveArcaStep1ViewMode('done')).toBe('recap');
  });
});

describe('resolveArcaStep2ViewMode', () => {
  it('es el acordeón/formulario en curso cuando el wizard está parado ahí', () => {
    expect(resolveArcaStep2ViewMode(2)).toBe('in_progress');
  });

  it('es el resumen "certificado verificado" si ya se avanzó al 3', () => {
    expect(resolveArcaStep2ViewMode(3)).toBe('recap');
    expect(resolveArcaStep2ViewMode('done')).toBe('recap');
  });
});

describe('validatePastedCertificate', () => {
  const body = 'A'.repeat(520);
  const validCert = `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;

  it('acepta un certificado bien formado', () => {
    expect(validatePastedCertificate(validCert)).toBeNull();
  });

  it('ignora espacios y saltos de línea (incluido \\r\\n) alrededor del cuerpo', () => {
    const conCrlf = `-----BEGIN CERTIFICATE-----\r\n${body.slice(0, 260)}\r\n${body.slice(260)}\r\n-----END CERTIFICATE-----`;
    expect(validatePastedCertificate(conCrlf)).toBeNull();
  });

  it('tolera espacio alrededor de todo el texto (trim)', () => {
    expect(validatePastedCertificate(`  ${validCert}  \n`)).toBeNull();
  });

  it('rechaza el campo vacío', () => {
    expect(validatePastedCertificate('')).toBeTruthy();
    expect(validatePastedCertificate('   ')).toBeTruthy();
  });

  it('rechaza cualquier cosa que no tenga los marcadores (el caso "aaaaaaaaaaaa")', () => {
    expect(validatePastedCertificate('aaaaaaaaaaaa')).toBeTruthy();
  });

  it('si pegó la solicitud (CSR) en vez del certificado, se lo dice', () => {
    const csr = `-----BEGIN CERTIFICATE REQUEST-----\n${body}\n-----END CERTIFICATE REQUEST-----`;
    expect(validatePastedCertificate(csr)).toMatch(/solicitud \(CSR\)/);
  });

  it('dice qué parte falta: el principio o el final', () => {
    expect(
      validatePastedCertificate(`${body}\n-----END CERTIFICATE-----`),
    ).toMatch(/principio/);
    expect(
      validatePastedCertificate(`-----BEGIN CERTIFICATE-----\n${body}`),
    ).toMatch(/final/);
  });

  it('rechaza si falta el marcador de cierre', () => {
    expect(
      validatePastedCertificate(`-----BEGIN CERTIFICATE-----\n${body}`),
    ).toBeTruthy();
  });

  it('rechaza si el cierre aparece ANTES que la apertura', () => {
    const alReves = `-----END CERTIFICATE-----\n${body}\n-----BEGIN CERTIFICATE-----`;
    expect(validatePastedCertificate(alReves)).toBeTruthy();
  });

  it('rechaza un cuerpo de menos de 500 caracteres', () => {
    const corto = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(100)}\n-----END CERTIFICATE-----`;
    expect(validatePastedCertificate(corto)).toBeTruthy();
  });

  it('rechaza un cuerpo con caracteres fuera de base64', () => {
    const conBasura = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(500)}#$%\n-----END CERTIFICATE-----`;
    expect(validatePastedCertificate(conBasura)).toBeTruthy();
  });

  it('acepta el cuerpo con los cuatro caracteres especiales de base64 (+ / = y el padding)', () => {
    const cuerpoConSimbolos = `${'A'.repeat(400)}+/==${'B'.repeat(120)}`;
    const cert = `-----BEGIN CERTIFICATE-----\n${cuerpoConSimbolos}\n-----END CERTIFICATE-----`;
    expect(validatePastedCertificate(cert)).toBeNull();
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

describe('describeInvoiceLetter', () => {
  it('responsable inscripto emite B; monotributo y exento, C', () => {
    expect(describeInvoiceLetter('responsable_inscripto')).toBe(
      'Factura B a consumidor final',
    );
    expect(describeInvoiceLetter('monotributo')).toBe('Factura C');
    expect(describeInvoiceLetter('exento')).toBe('Factura C');
  });
});
