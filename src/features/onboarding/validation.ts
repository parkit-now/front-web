const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keeps only the digits — the backend expects an 11-digit CUIT. */
export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '');
}

// ── Step 1: parking lot (sucursal) data ──────────────────────────────────────

export type SucursalField = 'name' | 'address' | 'totalSpots';
export type SucursalFieldErrors = Partial<Record<SucursalField, string>>;

/** El total se guarda como string en el form y se parsea antes de enviar. */
export type SucursalFormValues = {
  name: string;
  address: string;
  totalSpots: string;
};

export function validateName(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el nombre del estacionamiento';
  }
  return null;
}

export function validateAddress(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el domicilio';
  }
  return null;
}

/** Plazas totales: vacío → undefined; si no, un entero no negativo. */
export function parseTotalSpots(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}

/**
 * Las plazas son opcionales, pero un valor MAL ESCRITO no es lo mismo que uno
 * ausente: antes, "abc" caía a `undefined` en `parseSpots` y el solicitante
 * nunca se enteraba de que su capacidad declarada se había perdido. Con un solo
 * campo, validarlo sale gratis.
 */
export function validateTotalSpots(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return 'Ingresá un número entero de plazas (o dejalo vacío)';
  }
  return null;
}

/** Valida los campos obligatorios (nombre + domicilio) y el formato del total. */
export function validateSucursalForm(
  values: SucursalFormValues,
): SucursalFieldErrors {
  const errors: SucursalFieldErrors = {};
  const nameError = validateName(values.name);
  if (nameError) errors.name = nameError;
  const addressError = validateAddress(values.address);
  if (addressError) errors.address = addressError;
  const spotsError = validateTotalSpots(values.totalSpots);
  if (spotsError) errors.totalSpots = spotsError;
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
