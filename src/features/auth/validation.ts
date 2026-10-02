export type AuthField = 'name' | 'email' | 'password' | 'passwordConfirmation';
export type FieldErrors = Partial<Record<AuthField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_REQUIRED_MESSAGE = 'Este campo es obligatorio.';
export const NAME_INCOMPLETE_MESSAGE = 'Ingresá tu nombre y apellido';

/** Nombre y apellido: no vacío y al menos dos palabras. */
export function validateFullName(value: string): string | null {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return NAME_REQUIRED_MESSAGE;
  if (words.length < 2) return NAME_INCOMPLETE_MESSAGE;
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Ingresá tu email';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Email inválido';
  }
  return null;
}

export function validatePassword(
  value: string,
  { isNew }: { isNew: boolean } = { isNew: false },
): string | null {
  if (!value) {
    return 'Ingresá tu contraseña';
  }
  if (isNew && value.length < 8) {
    return 'Mínimo 8 caracteres';
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) {
    return 'Repetí la contraseña';
  }
  if (password !== confirmation) {
    return 'Las contraseñas no coinciden';
  }
  return null;
}
