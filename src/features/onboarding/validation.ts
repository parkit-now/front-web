import {
  missingAddressFields,
  unrecognizedAddressFields,
  type AddressFormValue,
  type AddressTextField,
} from '../../shared/components/AddressPicker/addressUtils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keeps only the digits — the backend expects an 11-digit CUIT. */
export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '');
}

// ── Step 1: parking lot (sucursal) data ──────────────────────────────────────

export type SucursalField = 'name' | 'address';
export type SucursalFieldErrors = Partial<Record<SucursalField, string>>;

/** Los campos de texto libre del paso 1. La dirección va aparte (ver abajo). */
export type SucursalTextField = 'name';

/**
 * `address` es la dirección ESTRUCTURADA que maneja el `AddressPicker`.
 *
 * `totalSpots` YA NO está: las plazas salieron del alta. La capacidad se
 * configura después desde `/app/config`, cuando el dueño ya sabe el número
 * real en vez de estimarlo para poder avanzar de paso.
 */
export type SucursalFormValues = {
  name: string;
  address: AddressFormValue;
};

export function validateName(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el nombre del estacionamiento';
  }
  return null;
}

/** Etiquetas para nombrar en el error EXACTAMENTE lo que falta completar. */
export const ADDRESS_FIELD_LABELS: Record<AddressTextField, string> = {
  formatted: 'la dirección',
  streetName: 'la calle',
  streetNumber: 'la altura',
  floor: 'el piso',
  cityName: 'la localidad',
  stateName: 'la provincia',
  postalCode: 'el código postal',
};

/**
 * El domicilio pasó a ser OBLIGATORIO en el alta.
 *
 * 🔴 "Obligatorio" es que los CAMPOS estén completos, NO que Georef haya
 * funcionado. Una API pública del Estado caída no puede frenar el alta de un
 * cliente: por eso se exige el CONTENIDO (calle, altura, localidad,
 * provincia), que se puede escribir a mano, y no el origen del dato.
 *
 * ⚠️ El mínimo es EL MISMO venga de donde venga. Antes había un atajo: si
 * `geocodingSource === 'georef'` y había línea de display, pasaba sin mirar
 * los campos. Eso dejaba el formulario al revés de como tiene que estar —
 * más exigente con la persona que carga a mano que con la API:
 *
 *   - Georef resuelve a medias más seguido de lo que parece. Buscar una calle
 *     sin altura ("Av. Cabildo, CABA") devuelve un candidato con `altura:
 *     null` y `nomenclatura` igual de linda. Con el atajo, esa dirección
 *     pasaba el alta y llegaba a Mercado Pago sin `street_number`.
 *   - Los cuatro campos no son una preferencia nuestra: son los que MP pide
 *     para la ubicación del `Store`. Que el dato lo haya escrito una persona o
 *     una API no cambia lo que MP necesita.
 *
 * Lo que sigue SIN exigirse: coordenadas (sin Georef no hay, y obligar a
 * arrastrar el pin sería el mismo portón por otra puerta), piso y código
 * postal (Georef no devuelve el CP: exigirlo haría la carga manual más
 * estricta que el propio autocompletado).
 *
 * La obligatoriedad es del FORMULARIO, no del esquema: las columnas de
 * `tenants` siguen siendo nullable y hay tenants viejos con `null`.
 */
export function validateAddress(value: AddressFormValue): string | null {
  const missing = missingAddressFields(value);
  if (missing.length > 0) return describeMissingAddressFields(missing);

  // "Lleno" no alcanza: el alta termina en una vinculación con Mercado Pago, y
  // MP valida la provincia y la localidad contra SU catálogo. Un borrador
  // guardado antes de que el formulario usara selectores puede traer "Martínez"
  // —completo, prolijo y rechazado por MP— y sin este chequeo pasaba derecho al
  // backend. Faltar un campo y tener uno que MP no conoce frenan el alta igual:
  // las dos terminan en un estacionamiento que no puede cobrar.
  const unrecognized = unrecognizedAddressFields(value);
  if (unrecognized.length > 0) {
    return describeUnrecognizedAddressFields(unrecognized);
  }

  return null;
}

/**
 * El mensaje del campo que Mercado Pago no reconoce.
 *
 * Nombra el valor que está guardado ("Martínez") en vez de decir sólo "la
 * localidad es inválida": la persona lo cargó creyendo que estaba bien, y sin
 * ver cuál es el texto en cuestión no entiende qué le están pidiendo cambiar.
 */
export function describeUnrecognizedAddressFields(
  unrecognized: readonly AddressTextField[],
): string {
  const labels = unrecognized.map((field) => ADDRESS_FIELD_LABELS[field]);
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
  return `Elegí ${list} de la lista: Mercado Pago no reconoce lo que está cargado y no vas a poder cobrar`;
}

/**
 * Arma el mensaje que NOMBRA los campos que faltan ("falta la calle, la altura
 * y la provincia").
 *
 * Está separado de `validateAddress` porque hay DOS caminos que llegan a este
 * mismo error: la validación local del wizard y el 422
 * `ONBOARDING_NOT_SUBMITTABLE` que devuelve el backend al enviar (ver
 * `errors.ts`). Que los dos digan exactamente lo mismo no es prolijidad: si el
 * servidor rechaza con otras palabras, la persona cree que es otro problema.
 */
export function describeMissingAddressFields(
  missing: readonly AddressTextField[],
): string {
  const labels = missing.map((field) => ADDRESS_FIELD_LABELS[field]);
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
  return `Ingresá el domicilio del estacionamiento: falta ${list}`;
}

/** Valida los dos campos obligatorios del paso 1: nombre y domicilio. */
export function validateSucursalForm(
  values: SucursalFormValues,
): SucursalFieldErrors {
  const errors: SucursalFieldErrors = {};
  const nameError = validateName(values.name);
  if (nameError) errors.name = nameError;
  const addressError = validateAddress(values.address);
  if (addressError) errors.address = addressError;
  return errors;
}

// ── Step 2: contact / legal data ─────────────────────────────────────────────

export type ContactField = 'legalName' | 'cuit' | 'email' | 'phone';
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export type ContactFormValues = {
  legalName: string;
  cuit: string;
  email: string;
  phone: string;
};

export function validateLegalName(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá la razón social';
  }
  return null;
}

export function validateCuit(value: string): string | null {
  const digits = normalizeCuit(value);
  if (!digits) {
    return 'Ingresá el CUIT';
  }
  if (digits.length !== 11) {
    return 'El CUIT debe tener 11 dígitos';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Ingresá el email de contacto';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Email inválido';
  }
  return null;
}

export function validatePhone(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el teléfono';
  }
  return null;
}

/** Validates the required contact fields (all required). */
export function validateContactForm(
  values: ContactFormValues,
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const legalNameError = validateLegalName(values.legalName);
  if (legalNameError) errors.legalName = legalNameError;
  const cuitError = validateCuit(values.cuit);
  if (cuitError) errors.cuit = cuitError;
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;
  return errors;
}
