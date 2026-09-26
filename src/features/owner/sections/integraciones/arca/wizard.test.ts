import { describe, expect, it } from 'vitest';
import type { ArcaAccount } from '../../../services/arca';
import {
  resolveArcaStep1ViewMode,
  resolveArcaStep2ViewMode,
  resolveArcaWizardStep,
  resolveClickableArcaWizardSteps,
  validateArcaFiscalDataForm,
  validateArcaPtoVta,
  validateArcaStep1Form,
  validatePastedCertificate,
  describeInvoiceLetters,
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

  it('Ingresos Brutos vacío no es un error (se confirma como «No contribuyente»)', () => {
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
  };

  it('acepta el formulario completo', () => {
    expect(validateArcaFiscalDataForm(base)).toEqual({});
  });

  it('exige razón social, condición IVA y domicilio fiscal', () => {
    const errors = validateArcaFiscalDataForm({
      razonSocial: '',
      condicionIva: '',
      domicilioFiscal: '',
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

describe('describeInvoiceLetters', () => {
  it('responsable inscripto: B a consumidor final y A a clientes con CUIT', () => {
    const text = describeInvoiceLetters('responsable_inscripto');
    expect(text).toContain('Factura B a consumidor final');
    expect(text).toContain('Factura A');
  });

  it('monotributo y exento: siempre C', () => {
    expect(describeInvoiceLetters('monotributo')).toContain('Factura C');
    expect(describeInvoiceLetters('exento')).toContain('Factura C');
  });
});
