import type { Rate, UpdateRateInput } from '../../services/rates';

export interface RateFormState {
  shortcutNumber: string;
  name: string;
  hourPriceArs: string;
  stayPriceArs: string;
  fractionPriceArs: string;
}

export type RateFormErrors = Partial<Record<keyof RateFormState, string>>;

export interface RateFormPayload {
  shortcutNumber: number;
  name: string;
  hourPriceArs: number;
  stayPriceArs: number;
  fractionPriceArs: number;
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

export function emptyRateForm(): RateFormState {
  return {
    shortcutNumber: '',
    name: '',
    hourPriceArs: '',
    stayPriceArs: '',
    fractionPriceArs: '',
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
  if (payload.shortcutNumber !== current.shortcutNumber) {
    body.shortcutNumber = payload.shortcutNumber;
  }
  return body;
}
