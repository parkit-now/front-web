export type CompanyField = 'legalName' | 'cuit' | 'email' | 'phone' | 'address';
export type CompanyFieldErrors = Partial<Record<CompanyField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keeps only the digits — the backend expects an 11-digit CUIT. */
export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '');
}

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

export function validateCompanyEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Ingresá el email de contacto';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Email inválido';
  }
  return null;
}

export type CompanyFormValues = {
  legalName: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
};

export function validatePhone(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el teléfono';
  }
  return null;
}

export function validateAddress(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el domicilio';
  }
  return null;
}

/** Validates the required company fields (all fields required). */
export function validateCompanyForm(
  values: CompanyFormValues,
): CompanyFieldErrors {
  const errors: CompanyFieldErrors = {};
  const legalNameError = validateLegalName(values.legalName);
  if (legalNameError) errors.legalName = legalNameError;
  const cuitError = validateCuit(values.cuit);
  if (cuitError) errors.cuit = cuitError;
  const emailError = validateCompanyEmail(values.email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(values.phone);
  if (phoneError) errors.phone = phoneError;
  const addressError = validateAddress(values.address);
  if (addressError) errors.address = addressError;
  return errors;
}

export function validateBranchName(value: string): string | null {
  if (!value.trim()) {
    return 'Ingresá el nombre de la sucursal';
  }
  return null;
}

export type BranchField = 'name' | 'address';
export type BranchFieldErrors = Partial<Record<BranchField, string>>;
export type BranchFormValues = { name: string; address: string };

export function validateBranchForm(
  values: BranchFormValues,
): BranchFieldErrors {
  const errors: BranchFieldErrors = {};
  if (!values.name.trim()) errors.name = 'Ingresá el nombre de la sucursal';
  if (!values.address.trim())
    errors.address = 'Ingresá el domicilio de la sucursal';
  return errors;
}
