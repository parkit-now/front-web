import type { Rate, UpdateRateInput } from '../../services/rates';

export interface RateFormState {
  shortcutNumber: string;
  name: string;
  hourPriceArs: string;
  stayPriceArs: string;
  fractionPriceArs: string;
  mediaEstadiaPriceArs: string;
  autoFractionPrice: boolean;
}

export type RateFormErrors = Partial<
  Record<Exclude<keyof RateFormState, 'autoFractionPrice'>, string>
>;

export interface RateFormPayload {
  shortcutNumber: number;
  name: string;
  hourPriceArs: number;
  stayPriceArs: number;
  fractionPriceArs: number;
  mediaEstadiaPriceArs: number;
  autoFractionPrice: boolean;
}

const MONEY_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;
const NAME_MAX_LENGTH = 120;

/** Acepta coma o punto como separador decimal, hasta 2 decimales, no negativo. */
export function validateMoney(raw: string): { value?: number; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { error: 'Este campo es obligatorio.' };
  if (!MONEY_PATTERN.test(trimmed)) {
    return { error: 'Ingresá un número válido con hasta 2 decimales.' };
  }
  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) return { error: 'Ingresá un número válido.' };
  if (parsed < 0) return { error: 'No puede ser negativo.' };
  return { value: parsed };
}

/** Precio numérico -> texto editable, con round-trip estable contra `validateMoney`. */
export function toMoneyInputString(value: number): string {
  return value.toFixed(2);
}

const FRACTIONS_PER_HOUR = 12;

export function derivedFractionPrice(hourPriceRaw: string): string {
  const hour = validateMoney(hourPriceRaw);
  if (hour.error || hour.value === undefined) return '';
  return toMoneyInputString(
    Math.round((hour.value / FRACTIONS_PER_HOUR) * 100) / 100,
  );
}

export function emptyRateForm(): RateFormState {
  return {
    shortcutNumber: '',
    name: '',
    hourPriceArs: '',
    stayPriceArs: '',
    fractionPriceArs: '',
    mediaEstadiaPriceArs: '',
    autoFractionPrice: true,
  };
}

export function rateToForm(rate: Rate): RateFormState {
  return {
    shortcutNumber:
      rate.shortcutNumber != null ? String(rate.shortcutNumber) : '',
    name: rate.name,
    hourPriceArs: toMoneyInputString(rate.hourPriceArs),
    stayPriceArs: toMoneyInputString(rate.stayPriceArs),
    fractionPriceArs: toMoneyInputString(rate.fractionPriceArs),
    mediaEstadiaPriceArs: toMoneyInputString(rate.mediaEstadiaPriceArs),
    autoFractionPrice: rate.autoFractionPrice,
  };
}

/** Primer entero >= 1 que no esté usado como atajo, para precargar el alta. */
export function nextFreeShortcut(rates: Rate[]): number {
  const used = new Set(
    rates
      .map((rate) => rate.shortcutNumber)
      .filter((value): value is number => value != null),
  );
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

/** Habilita el submit sin llegar a pintar errores mientras el usuario tipea. */
export function canSubmitRateForm(form: RateFormState): boolean {
  const name = form.name.trim();
  const shortcut = parseInt(form.shortcutNumber.trim(), 10);
  return (
    name.length > 0 &&
    name.length <= NAME_MAX_LENGTH &&
    !validateMoney(form.hourPriceArs).error &&
    !validateMoney(form.stayPriceArs).error &&
    !validateMoney(form.fractionPriceArs).error &&
    !validateMoney(form.mediaEstadiaPriceArs).error &&
    Number.isInteger(shortcut) &&
    shortcut >= 1
  );
}

export function validateRateForm(
  form: RateFormState,
  ctx: { rates: Rate[]; editingId: string | null },
): { errors: RateFormErrors; payload?: RateFormPayload } {
  const errors: RateFormErrors = {};

  const name = form.name.trim();
  if (name.length === 0) {
    errors.name = 'El nombre es obligatorio.';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = 'Máximo 120 caracteres.';
  }

  const hour = validateMoney(form.hourPriceArs);
  if (hour.error) errors.hourPriceArs = hour.error;

  const stay = validateMoney(form.stayPriceArs);
  if (stay.error) errors.stayPriceArs = stay.error;

  const fraction = validateMoney(form.fractionPriceArs);
  if (fraction.error) errors.fractionPriceArs = fraction.error;

  const mediaEstadia = validateMoney(form.mediaEstadiaPriceArs);
  if (mediaEstadia.error) {
    errors.mediaEstadiaPriceArs = mediaEstadia.error;
  } else if (
    !stay.error &&
    mediaEstadia.value !== undefined &&
    stay.value !== undefined &&
    mediaEstadia.value > stay.value
  ) {
    errors.mediaEstadiaPriceArs = 'No puede superar el precio de la estadía.';
  }

  const shortcutRaw = form.shortcutNumber.trim();
  const shortcutN = parseInt(shortcutRaw, 10);
  let shortcutNumber = 0;
  if (shortcutRaw.length === 0) {
    errors.shortcutNumber = 'El número de atajo es obligatorio.';
  } else if (
    !Number.isInteger(shortcutN) ||
    shortcutN < 1 ||
    // Rechaza "01", "1.5" y "1abc": el texto tiene que ser el entero exacto.
    String(shortcutN) !== shortcutRaw
  ) {
    errors.shortcutNumber = 'Debe ser un entero positivo.';
  } else {
    const conflict = ctx.rates.find(
      (rate) => rate.shortcutNumber === shortcutN && rate.id !== ctx.editingId,
    );
    if (conflict) {
      errors.shortcutNumber = `El número ${shortcutN} ya está ocupado por "${conflict.name}".`;
    } else {
      shortcutNumber = shortcutN;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors,
    payload: {
      shortcutNumber,
      name,
      hourPriceArs: hour.value ?? 0,
      stayPriceArs: stay.value ?? 0,
      fractionPriceArs: fraction.value ?? 0,
      mediaEstadiaPriceArs: mediaEstadia.value ?? 0,
      autoFractionPrice: form.autoFractionPrice,
    },
  };
}

/**
 * Solo los campos que cambiaron. Devuelve `{}` cuando no hay nada que guardar,
 * para no gastar un PATCH al pedo.
 */
export function diffRateUpdate(
  payload: RateFormPayload,
  current: Rate,
): UpdateRateInput {
  const body: UpdateRateInput = {};
  if (payload.name !== current.name) body.name = payload.name;
  if (payload.hourPriceArs !== current.hourPriceArs) {
    body.hourPriceArs = payload.hourPriceArs;
  }
  if (payload.stayPriceArs !== current.stayPriceArs) {
    body.stayPriceArs = payload.stayPriceArs;
  }
  if (payload.fractionPriceArs !== current.fractionPriceArs) {
    body.fractionPriceArs = payload.fractionPriceArs;
  }
  if (payload.mediaEstadiaPriceArs !== current.mediaEstadiaPriceArs) {
    body.mediaEstadiaPriceArs = payload.mediaEstadiaPriceArs;
  }
  if (payload.autoFractionPrice !== current.autoFractionPrice) {
    body.autoFractionPrice = payload.autoFractionPrice;
  }
  if (payload.shortcutNumber !== current.shortcutNumber) {
    body.shortcutNumber = payload.shortcutNumber;
  }
  return body;
}

/**
 * Los cuatro campos que cambian lo que se le cobra a un auto.
 *
 * GEMELO CONCEPTUAL de `front-desktop/src/features/rates/rateDiff.ts`. El
 * código está duplicado porque los repos no comparten módulos, pero las reglas
 * tienen que coincidir: si divergen, una app pregunta y la otra no sobre el
 * mismo cambio.
 */
export const RATE_PRICE_FIELDS = [
  'hourPriceArs',
  'fractionPriceArs',
  'mediaEstadiaPriceArs',
  'stayPriceArs',
] as const;

/**
 * Si esta edición toca algún precio.
 *
 * Es lo único que dispara la pregunta sobre los autos que están adentro.
 * Renombrar la tarifa, cambiarle el atajo o activarla/desactivarla no cambia
 * lo que se cobra, y preguntar ahí sería ruido que el dueño aprende a saltear
 * sin leer — y el día que importa, tampoco lo lee.
 *
 * `autoFractionPrice` NO cuenta: es una preferencia del formulario y el motor
 * de cobro ni la mira. Pero prenderla reescribe `fractionPriceArs`, y ese sí
 * cuenta. El disparador es siempre el campo de precio, nunca el flag.
 *
 * Mira PRESENCIA de clave y no valores, porque el body ya es el diff — así un
 * precio puesto en cero, que es falsy, sigue contando como cambio.
 */
export function hasPriceChange(body: UpdateRateInput): boolean {
  return RATE_PRICE_FIELDS.some((field) => body[field] !== undefined);
}

/** Las filas "Hora $3.500 → $3.900" que muestra el diálogo. */
export function priceDiffRows(
  body: UpdateRateInput,
  current: Rate,
): { label: string; before: number; after: number }[] {
  const labels: Record<(typeof RATE_PRICE_FIELDS)[number], string> = {
    hourPriceArs: 'Hora',
    fractionPriceArs: 'Fracción',
    mediaEstadiaPriceArs: 'Media estadía',
    stayPriceArs: 'Estadía',
  };

  return RATE_PRICE_FIELDS.filter((field) => body[field] !== undefined).map(
    (field) => ({
      label: labels[field],
      before: current[field] ?? 0,
      after: body[field] ?? 0,
    }),
  );
}
