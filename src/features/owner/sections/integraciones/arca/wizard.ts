import type { ArcaAccount, ArcaTaxCondition } from '../../../services/arca';
import { validateArcaIibb } from '../validation';
import { validateArcaCuit } from './cuit';

/**
 * Lógica pura del wizard de vinculación de ARCA: en qué paso retomar y qué
 * validar en cada uno. Separada del componente (con tests colocalizados) por
 * la misma razón que `sections/integraciones/validation.ts`: la precedencia
 * entre pasos no necesita DOM ni red, y si se rompe lo hace en silencio.
 */

export type ArcaWizardStep = 1 | 2 | 3 | 'done';

/**
 * En qué paso retomar el wizard, a partir de la cuenta que ya existe (o no).
 *
 *  - Sin cuenta → paso 1 (datos comerciales).
 *  - `pending_certificate` → paso 2 (certificado).
 *  - `pending_sales_point` sin `condicionIva` → paso 2 todavía: al padrón de
 *    homologación le faltan los datos fiscales y hay que cargarlos a mano
 *    antes de poder elegir punto de venta (la letra de la factura depende de
 *    la condición frente al IVA).
 *  - `pending_sales_point` con `condicionIva` → paso 3 (punto de venta).
 *  - Cualquier otro estado (`linked`, `cert_expired`) → `done`: la pantalla
 *    final. Un certificado vencido no tiene un paso propio en el wizard (no
 *    hay endpoint de "renovar" separado de crear cuenta de nuevo); se
 *    resuelve desde la tarjeta de Integraciones, no reentrando acá.
 */
export function resolveArcaWizardStep(
  account: ArcaAccount | null,
): ArcaWizardStep {
  if (account === null) return 1;
  if (account.status === 'pending_certificate') return 2;
  if (account.status === 'pending_sales_point') {
    return account.condicionIva == null ? 2 : 3;
  }
  return 'done';
}

// ── Paso 1: datos comerciales ────────────────────────────────────────────────

export type ArcaStep1FormValues = {
  cuit: string;
  iibb: string;
};

export type ArcaStep1FieldErrors = Partial<
  Record<keyof ArcaStep1FormValues, string>
>;

/**
 * CUIT e Ingresos Brutos, los dos obligatorios: IIBB va impreso en la factura
 * (RG 1415), como número o como «Exento» / «No contribuyente».
 */
export function validateArcaStep1Form(
  values: ArcaStep1FormValues,
): ArcaStep1FieldErrors {
  const errors: ArcaStep1FieldErrors = {};
  const cuitError = validateArcaCuit(values.cuit);
  if (cuitError) errors.cuit = cuitError;
  const iibbError = validateArcaIibb(values.iibb);
  if (iibbError) errors.iibb = iibbError;
  return errors;
}

/** Los 3 pasos numerados del wizard, para el stepper de arriba. */
export const ARCA_WIZARD_NUMERIC_STEPS = [1, 2, 3] as const;
export type ArcaWizardNumericStep = (typeof ARCA_WIZARD_NUMERIC_STEPS)[number];

/**
 * Qué pasos del stepper se pueden clickear para volver a verlos.
 *
 * Son los YA ALCANZADOS (≤ el paso natural), incluido el actual: clickearlo
 * no hace nada distinto de lo que ya se está viendo, pero no hay motivo para
 * bloquearlo. Con la cuenta `linked` (o `cert_expired`, que también cae en
 * `'done'`) el wizard ya terminó: ahí no se puede volver a tocar nada, así
 * que ningún paso es clickeable.
 */
export function resolveClickableArcaWizardSteps(
  naturalStep: ArcaWizardStep,
): readonly ArcaWizardNumericStep[] {
  if (naturalStep === 'done') return [];
  return ARCA_WIZARD_NUMERIC_STEPS.filter((n) => n <= naturalStep);
}

/**
 * En qué modo mostrar el paso 1 al volver: `'form'` es el formulario normal
 * (recién ahí es donde está parado el wizard); `'recap'` es el resumen de
 * sólo lectura con "Continuar" / "Cambiar CUIT", para cuando ya existe una
 * cuenta y el dueño clickeó el paso 1 del stepper para volver a mirarlo.
 */
export function resolveArcaStep1ViewMode(
  naturalStep: ArcaWizardStep,
): 'form' | 'recap' {
  return naturalStep === 1 ? 'form' : 'recap';
}

/**
 * Lo mismo para el paso 2: `'in_progress'` es el acordeón/formulario de
 * datos fiscales de siempre (el wizard está parado ahí); `'recap'` es el
 * resumen "Certificado verificado" con "Continuar" / "Cargar otro
 * certificado", para cuando el certificado ya se verificó (la cuenta ya
 * pasó al paso 3) y el dueño volvió a mirar el paso 2 desde el stepper.
 */
export function resolveArcaStep2ViewMode(
  naturalStep: ArcaWizardStep,
): 'in_progress' | 'recap' {
  return naturalStep === 2 ? 'in_progress' : 'recap';
}

// ── Paso 2: certificado pegado a mano ────────────────────────────────────────

const CERT_BEGIN = '-----BEGIN CERTIFICATE-----';
const CERT_END = '-----END CERTIFICATE-----';
/** Un certificado real ronda varios miles de caracteres en base64; 500 alcanza para descartar cualquier cosa que no sea un certificado pegado entero. */
const CERT_BODY_MIN_LENGTH = 500;
const CERT_BODY_PATTERN = /^[A-Za-z0-9+/=]+$/;

const CERT_FORMAT_ERROR =
  'Pegá el certificado completo, desde -----BEGIN CERTIFICATE----- hasta -----END CERTIFICATE-----.';
const CERT_IS_CSR_ERROR =
  'Eso es la solicitud (CSR), no el certificado. Pegá lo que ARCA te muestra en «Resultado», después de apretar «Crear DN y Obtener Certificado».';
const CERT_MISSING_END_ERROR =
  'Falta el final del certificado: copialo completo, hasta -----END CERTIFICATE-----.';
const CERT_MISSING_BEGIN_ERROR =
  'Falta el principio del certificado: copialo completo, desde -----BEGIN CERTIFICATE-----.';
const CERT_TRUNCATED_ERROR =
  'El certificado está incompleto o tiene caracteres de más. Copialo de nuevo, entero, desde ARCA.';

/**
 * Valida el certificado pegado a mano en el paso 2 (sub-paso 4), ANTES de
 * mandarlo a verificar contra ARCA.
 *
 * Es sólo el aviso temprano: el backend vuelve a validar de verdad (firma,
 * CUIT, vigencia...) y ahí es donde puede rechazarlo con `ARCA_CERT_INVALID`
 * y compañía. Esto evita el viaje de red con algo que a todas luces no es un
 * certificado — como pegar "aaaaaaaaaaaa".
 *
 * Cada falla tiene su mensaje, porque "no es válido" solo no le dice al dueño
 * qué hizo mal. El error más probable es pegar la SOLICITUD: en WSASS el
 * cuadro de la solicitud y el del resultado están uno arriba del otro y se
 * ven casi iguales.
 *
 * Exige el marcador de apertura, el de cierre DESPUÉS del de apertura, y
 * entre los dos un cuerpo (sacando espacios y saltos de línea, `\r\n`
 * incluido) de al menos 500 caracteres que sean sólo base64
 * (`[A-Za-z0-9+/=]`). No decodifica el base64 ni mira la fecha: eso es
 * trabajo del backend.
 */
export function validatePastedCertificate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return CERT_FORMAT_ERROR;
  if (text.includes('CERTIFICATE REQUEST')) return CERT_IS_CSR_ERROR;

  const beginIndex = text.indexOf(CERT_BEGIN);
  const endIndex = text.indexOf(
    CERT_END,
    beginIndex === -1 ? 0 : beginIndex + CERT_BEGIN.length,
  );
  if (beginIndex === -1 && endIndex === -1) return CERT_FORMAT_ERROR;
  if (beginIndex === -1) return CERT_MISSING_BEGIN_ERROR;
  if (endIndex === -1) return CERT_MISSING_END_ERROR;

  const body = text
    .slice(beginIndex + CERT_BEGIN.length, endIndex)
    .replace(/\s+/g, '');
  if (body.length < CERT_BODY_MIN_LENGTH || !CERT_BODY_PATTERN.test(body)) {
    return CERT_TRUNCATED_ERROR;
  }

  return null;
}

// ── Paso 2: datos fiscales a mano (padrón de homologación sin el CUIT) ──────

/**
 * Qué facturas emite cada condición frente al IVA, en palabras del dueño. Se
 * muestra al confirmar los datos fiscales: la condición decide las letras de
 * TODAS las facturas, así que tiene que quedar claro antes de guardarla.
 *
 * Describe la CONDICIÓN, no lo que Parkit emite hoy: aunque por ahora sólo se
 * factura a consumidor final (B o C), un responsable inscripto también emite A
 * a clientes con CUIT (Etapa 5). La regla vive en
 * `backend/src/arca/resolve-voucher.ts`.
 */
export function describeInvoiceLetters(condicion: ArcaTaxCondition): string {
  return condicion === 'responsable_inscripto'
    ? 'Factura B a consumidor final y Factura A a clientes con CUIT que sean responsables inscriptos o monotributistas'
    : 'siempre Factura C, a cualquier cliente';
}

export type ArcaFiscalDataFormValues = {
  razonSocial: string;
  condicionIva: ArcaTaxCondition | '';
  domicilioFiscal: string;
};

export type ArcaFiscalDataFieldErrors = Partial<
  Record<keyof ArcaFiscalDataFormValues, string>
>;

/**
 * Se usa sólo cuando `padronFound` fue `false` y `fiscalDataEditable`: el
 * padrón de homologación no tiene datos reales para ese CUIT de prueba, así
 * que hay que cargarlos a mano para poder elegir la letra de la factura.
 */
export function validateArcaFiscalDataForm(
  values: ArcaFiscalDataFormValues,
): ArcaFiscalDataFieldErrors {
  const errors: ArcaFiscalDataFieldErrors = {};
  if (!values.razonSocial.trim()) {
    errors.razonSocial = 'Ingresá la razón social';
  }
  if (!values.condicionIva) {
    errors.condicionIva = 'Elegí la condición frente al IVA';
  }
  if (!values.domicilioFiscal.trim()) {
    errors.domicilioFiscal = 'Ingresá el domicilio fiscal';
  }
  return errors;
}

// ── Paso 3: punto de venta ───────────────────────────────────────────────────

/** Mensaje de error del número de punto de venta, o `null` si es válido. */
export function validateArcaPtoVta(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Ingresá el punto de venta';
  if (!/^\d+$/.test(trimmed)) {
    return 'El punto de venta tiene que ser un número';
  }
  const value = Number(trimmed);
  if (value < 1 || value > 99998) {
    return 'El punto de venta tiene que estar entre 1 y 99998';
  }
  return null;
}
