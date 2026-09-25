import type {
  ArcaAccount,
  ArcaEnvironment,
  ArcaTaxCondition,
} from '../../../services/arca';
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

/** Ingresos Brutos es opcional: sólo se valida el CUIT. */
export function validateArcaStep1Form(
  values: ArcaStep1FormValues,
): ArcaStep1FieldErrors {
  const errors: ArcaStep1FieldErrors = {};
  const cuitError = validateArcaCuit(values.cuit);
  if (cuitError) errors.cuit = cuitError;
  return errors;
}

// ── Paso 2: datos fiscales a mano (padrón de homologación sin el CUIT) ──────

export type ArcaFiscalDataFormValues = {
  razonSocial: string;
  condicionIva: ArcaTaxCondition | '';
  domicilioFiscal: string;
  /** AAAA-MM-DD, opcional. */
  inicioActividad: string;
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

/** Tamaño máximo de la constancia del punto de venta (PDF), en bytes. */
export const ARCA_CONSTANCIA_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Valida el archivo de la constancia del punto de venta.
 *
 * Obligatoria SOLO en producción: en homologación el punto de venta ni
 * siquiera hace falta darlo de alta en ARCA, así que pedir la constancia ahí
 * sería un freno sin motivo.
 */
export function validateArcaConstancia(input: {
  file: { type: string; size: number } | null;
  environment: ArcaEnvironment;
}): string | null {
  const { file, environment } = input;
  if (!file) {
    return environment === 'produccion'
      ? 'Subí la constancia del punto de venta'
      : null;
  }
  if (file.type !== 'application/pdf') {
    return 'La constancia tiene que ser un PDF';
  }
  if (file.size > ARCA_CONSTANCIA_MAX_BYTES) {
    return 'La constancia no puede pesar más de 5 MB';
  }
  return null;
}
