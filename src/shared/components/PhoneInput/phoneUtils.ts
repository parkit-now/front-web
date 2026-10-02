import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js/min';
import examples from 'libphonenumber-js/examples.mobile.json';

export type PhoneCountry = CountryCode;

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = 'AR';

export const PHONE_REQUIRED_MESSAGE = 'Este campo es obligatorio.';
export const PHONE_INVALID_MESSAGE = 'Ingresá un teléfono válido';

/**
 * Valida un teléfono en E.164. Devuelve el mensaje de error o `null` si está
 * bien. Vacío es válido salvo que `required`.
 */
export function validatePhone(
  value: string | null | undefined,
  { required = false }: { required?: boolean } = {},
): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return required ? PHONE_REQUIRED_MESSAGE : null;
  return isValidPhoneNumber(trimmed) ? null : PHONE_INVALID_MESSAGE;
}

/**
 * Formato internacional para mostrar (`+54 11 2345 6789`). Los teléfonos
 * guardados antes de usar E.164 no se parsean: se devuelven tal cual.
 */
export function formatPhoneForDisplay(
  value: string | null | undefined,
): string {
  const raw = (value ?? '').trim();
  if (!raw.startsWith('+')) return raw;
  const parsed = parsePhoneNumberFromString(raw);
  return parsed ? parsed.formatInternational() : raw;
}

/** Prefijo telefónico con "+" (`+54`). */
export function callingCodeOf(country: PhoneCountry): string {
  return `+${getCountryCallingCode(country)}`;
}

/**
 * ÚNICO formato nacional que muestra el input, tanto al tipear como al cargar
 * un valor guardado. Antes cada camino tenía el suyo: al tipear salía lo que
 * escribía la persona ("11 2345-6789") y al reabrir `formatNational()` le
 * sumaba el 0 troncal ("011 2345-6789").
 *
 * Es el `formatNational()` de libphonenumber, salvo en Argentina: ahí se saca
 * el 0 troncal (y el "15" sigue donde lo pone la librería), porque el número
 * que se guarda es el significativo y el 0 es un detalle de discado que la
 * persona puede escribir o no.
 */
export function formatNationalDisplay(number: PhoneNumber): string {
  const national = number.formatNational();
  return number.country === 'AR' ? national.replace(/^0/, '') : national;
}

/**
 * Ejemplo de número nacional para la ayuda bajo el input, en el MISMO formato
 * que muestra el input. libphonenumber sólo trae ejemplos de celulares; para
 * Argentina, el caso de uso principal, se muestra un fijo porque es el formato
 * que la gente reconoce.
 */
export function getPhoneExample(country: PhoneCountry): string {
  if (country === 'AR') return '11 2345-6789';
  const example = getExampleNumber(country, examples);
  return example ? formatNationalDisplay(example) : '';
}

/** Parsea un E.164 guardado para ubicar país y número nacional formateado. */
export function parseStoredPhone(
  value: string | null | undefined,
): { country: PhoneCountry; text: string } | null {
  const raw = (value ?? '').trim();
  if (!raw.startsWith('+')) return null;
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed?.country) return null;
  return { country: parsed.country, text: formatNationalDisplay(parsed) };
}

export interface TypedPhone {
  country: PhoneCountry;
  /** Texto a mostrar en el input, formateado. */
  text: string;
  /** E.164 (o mejor aproximación si todavía está incompleto); '' si vacío. */
  e164: string;
}

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '');
}

function formatTyped(raw: string, country: PhoneCountry): TypedPhone {
  let digits = digitsOf(raw);
  // En Argentina el 0 troncal no se muestra ni cuenta: "011 2345-6789" y
  // "11 2345-6789" son la misma persona escribiendo distinto.
  if (country === 'AR') digits = digits.replace(/^0/, '');
  if (!digits) return { country, text: '', e164: '' };
  const typer = new AsYouType(country);
  const typed = typer.input(digits);
  const number = typer.getNumber();
  const e164 = number?.number ?? `${callingCodeOf(country)}${digits}`;
  // Número completo y válido: exactamente el formato de un valor guardado.
  const text =
    number?.country === country && number.isValid()
      ? formatNationalDisplay(number)
      : typed;
  return { country, text, e164 };
}

/**
 * Procesa lo que la persona tipea o pega. Si empieza con "+" se interpreta
 * como internacional y puede cambiar el país; si no, se formatea para el país
 * elegido. `previousText` sirve para que borrar un separador (espacio, guion)
 * borre el dígito anterior en vez de quedarse trabado.
 */
export function applyTypedPhone(
  raw: string,
  country: PhoneCountry,
  previousText = '',
): TypedPhone {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('+')) {
    const typer = new AsYouType();
    typer.input(trimmed);
    const detected = typer.getCountry();
    const parsed = typer.getNumber();
    if (detected && parsed) {
      return {
        country: detected,
        text: formatNationalDisplay(parsed),
        e164: parsed.number,
      };
    }
    // Prefijo todavía incompleto: se deja lo tipeado sin tocar el país.
    const digits = digitsOf(trimmed);
    return {
      country,
      text: typer.input(trimmed) ? `+${digits}` : '',
      e164: digits ? `+${digits}` : '',
    };
  }

  let next = formatTyped(raw, country);
  if (raw.length < previousText.length && next.text === previousText) {
    const digits = digitsOf(raw);
    next = formatTyped(digits.slice(0, -1), country);
  }
  return next;
}

/** Re-emite el E.164 al cambiar de país conservando el número tipeado. */
export function changePhoneCountry(
  text: string,
  country: PhoneCountry,
): TypedPhone {
  return formatTyped(digitsOf(text), country);
}

export interface PhoneCountryOption {
  code: PhoneCountry;
  name: string;
  callingCode: string;
}

/** Todos los países con nombre en español, Argentina primero y luego A-Z. */
export function getPhoneCountryOptions(
  available?: ReadonlySet<string>,
): PhoneCountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    names = null;
  }
  const options = getCountries()
    .filter((code) => !available || available.has(code))
    .map((code) => ({
      code,
      name: names?.of(code) ?? code,
      callingCode: callingCodeOf(code),
    }));
  options.sort((a, b) => {
    if (a.code === DEFAULT_PHONE_COUNTRY) return -1;
    if (b.code === DEFAULT_PHONE_COUNTRY) return 1;
    return a.name.localeCompare(b.name, 'es');
  });
  return options;
}

/** Normaliza para buscar sin tildes ni mayúsculas. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterPhoneCountries(
  options: PhoneCountryOption[],
  query: string,
): PhoneCountryOption[] {
  const q = normalizeSearch(query.trim());
  if (!q) return options;
  const qDigits = q.replace(/\D/g, '');
  return options.filter(
    (o) =>
      normalizeSearch(o.name).includes(q) ||
      o.code.toLowerCase() === q ||
      (qDigits.length > 0 && o.callingCode.slice(1).startsWith(qDigits)),
  );
}
