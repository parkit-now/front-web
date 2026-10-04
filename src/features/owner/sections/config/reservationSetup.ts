import { calcStayPrice } from '../../../../shared/pricing/calcStayPrice';
import {
  SCHEDULE_DAYS,
  type ScheduleRange,
} from '../../../../shared/components/WeeklyScheduleEditor';
import type { Rate } from '../../services/rates';
import type {
  ReservationHours,
  ReservationRequirement,
  ReservationVehicleCategory,
  ServiceItem,
  UpdateServiceInput,
} from '../../services/services';
import type { VehicleType } from '../../services/vehicle-types';
import { parseCapacityTotal } from './capacity';

/**
 * Lógica pura de la tarjeta de configuración de reservas. Vive acá y no en el
 * componente porque este repo no tiene infraestructura para testear
 * componentes: lo que puede fallar se testea como funciones.
 */

export type AcceptanceMode = ServiceItem['acceptanceMode'];
export type HoursMode = ServiceItem['reservationHoursMode'];

/** Texto de los campos numéricos tal cual los tipea la persona. */
export interface ReservationForm {
  reservableSpots: string;
  categories: ReservationVehicleCategory[];
  hoursMode: HoursMode;
  ranges: ScheduleRange[];
  rateId: string;
  acceptanceMode: AcceptanceMode;
  approvalWindowMinutes: string;
  /** Cancelación gratis hasta [n] [minutos|horas] antes (0–1440 min). */
  freeCancelValue: string;
  freeCancelUnit: DurationUnit;
  lateCancelRefundPct: string;
  /**
   * "Llegada desde" del backend. Ya no se edita en la UI (se unificó con el
   * tope de llegada anticipada): se conserva el valor actual y al guardar se
   * manda `min(actual, earlyArrivalMaxMinutes)` para no violar la regla
   * `earlyArrivalMax >= earlyArrival`.
   */
  earlyArrivalMinutes: string;
  /** Tolerancia: guardamos el lugar hasta [n] [minutos|horas] después (0–180 min). */
  graceValue: string;
  graceUnit: DurationUnit;
  /**
   * Tope de la llegada anticipada (fase 6c): "Llegada anticipada: hasta
   * [número] [minutos|horas] antes". Se guarda en minutos; acá queda el número
   * y la unidad tal cual los eligió el dueño.
   */
  earlyArrivalMaxValue: string;
  earlyArrivalMaxUnit: DurationUnit;
}

export type DurationUnit = 'minutes' | 'hours';

/** Tope de la tolerancia (`graceMinutes`): 180 min. */
export const GRACE_LIMIT = { max: 180, message: 'Hasta 3 horas.' } as const;

/** Topes de `earlyArrivalMaxMinutes` (CHECK de la migración 20261007120000). */
export const EARLY_ARRIVAL_MAX_LIMIT_MINUTES = 1440;

/**
 * Minutos → número + unidad para mostrar: horas si son horas justas (60 →
 * "1 hora"), si no minutos (45 → "45 minutos"; 90 → "90 minutos").
 */
export function splitDuration(minutes: number): {
  value: string;
  unit: DurationUnit;
} {
  if (minutes > 0 && minutes % 60 === 0) {
    return { value: String(minutes / 60), unit: 'hours' };
  }
  return { value: String(minutes), unit: 'minutes' };
}

/**
 * Número + unidad → minutos enteros, o el error para mostrar. Las horas
 * aceptan medias y cuartos ("1,5" horas = 90 min) mientras den minutos
 * enteros.
 */
export function durationToMinutes(
  raw: string,
  unit: DurationUnit,
  limit: { max: number; message: string } = {
    max: EARLY_ARRIVAL_MAX_LIMIT_MINUTES,
    message: 'Hasta 24 horas.',
  },
): number | { error: string } {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return { error: 'Completá este valor.' };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return { error: 'Tiene que ser un número positivo.' };
  }
  const minutes = unit === 'hours' ? value * 60 : value;
  if (!Number.isInteger(minutes)) {
    return {
      error:
        unit === 'hours'
          ? 'Usá horas enteras o en minutos.'
          : 'Tiene que ser un número entero.',
    };
  }
  if (minutes > limit.max) {
    return { error: limit.message };
  }
  return minutes;
}

/** "1 hora", "2 horas", "45 minutos", "1 h 30 min" para el resumen. */
export function formatDuration(minutes: number): string {
  if (minutes === 0) return '0 minutos';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m === 1 ? '1 minuto' : `${m} minutos`;
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h} h ${m} min`;
}

export const LATE_REFUND_OPTIONS = [0, 50, 100] as const;

function sortRanges(ranges: readonly ScheduleRange[]): ScheduleRange[] {
  const order = new Map(SCHEDULE_DAYS.map((d, i) => [d.id, i]));
  return [...ranges]
    .map(({ day, openMinute, closeMinute }) => ({
      day,
      openMinute,
      closeMinute,
    }))
    .sort(
      (a, b) =>
        (order.get(a.day) ?? 0) - (order.get(b.day) ?? 0) ||
        a.openMinute - b.openMinute,
    );
}

export function toReservationForm(
  service: ServiceItem,
  hours: ReservationHours,
): ReservationForm {
  return {
    reservableSpots:
      service.reservableSpots === null ? '' : String(service.reservableSpots),
    categories: [...service.reservationVehicleCategories],
    hoursMode: hours.mode,
    ranges: sortRanges(hours.ranges),
    rateId: service.reservationRateId ?? '',
    acceptanceMode: service.acceptanceMode,
    approvalWindowMinutes: String(service.approvalWindowMinutes),
    ...(() => {
      const { value, unit } = splitDuration(service.freeCancelMinutes);
      return { freeCancelValue: value, freeCancelUnit: unit };
    })(),
    lateCancelRefundPct: String(service.lateCancelRefundPct),
    earlyArrivalMinutes: String(service.earlyArrivalMinutes),
    ...(() => {
      const { value, unit } = splitDuration(service.graceMinutes);
      return { graceValue: value, graceUnit: unit };
    })(),
    ...(() => {
      const { value, unit } = splitDuration(service.earlyArrivalMaxMinutes);
      return { earlyArrivalMaxValue: value, earlyArrivalMaxUnit: unit };
    })(),
  };
}

/** En modo `opening` los rangos no cuentan: el backend los borra. */
function canonical(form: ReservationForm) {
  // "1 hora" y "60 minutos" son lo mismo: se compara en minutos.
  const key = (
    value: string,
    unit: DurationUnit,
    limit?: typeof GRACE_LIMIT,
  ) => {
    const minutes = durationToMinutes(value, unit, limit);
    return typeof minutes === 'number' ? minutes : `${value} ${unit}`;
  };
  const {
    earlyArrivalMaxValue,
    earlyArrivalMaxUnit,
    freeCancelValue,
    freeCancelUnit,
    graceValue,
    graceUnit,
    ...rest
  } = form;
  return {
    ...rest,
    earlyArrivalMax: key(earlyArrivalMaxValue, earlyArrivalMaxUnit),
    freeCancel: key(freeCancelValue, freeCancelUnit),
    grace: key(graceValue, graceUnit, GRACE_LIMIT),
    categories: [...form.categories].sort(),
    ranges: form.hoursMode === 'custom' ? sortRanges(form.ranges) : [],
    reservableSpots: form.reservableSpots.trim(),
  };
}

export function isDirty(
  form: ReservationForm,
  initial: ReservationForm,
): boolean {
  return JSON.stringify(canonical(form)) !== JSON.stringify(canonical(initial));
}

export function hoursChanged(
  form: ReservationForm,
  initial: ReservationForm,
): boolean {
  const a = canonical(form);
  const b = canonical(initial);
  return (
    a.hoursMode !== b.hoursMode ||
    JSON.stringify(a.ranges) !== JSON.stringify(b.ranges)
  );
}

export type ReservationFormField =
  | 'reservableSpots'
  | 'approvalWindowMinutes'
  | 'freeCancelMinutes'
  | 'lateCancelRefundPct'
  | 'graceMinutes'
  | 'earlyArrivalMax';

export type FormErrors = Partial<Record<ReservationFormField, string>>;

function parseIntInRange(
  raw: string,
  min: number,
  max: number,
): number | string {
  const trimmed = raw.trim();
  if (trimmed === '') return 'Completá este valor.';
  const value = Number(trimmed);
  if (!Number.isInteger(value)) return 'Tiene que ser un número entero.';
  if (value < min || value > max) return `Entre ${min} y ${max}.`;
  return value;
}

/**
 * Arma el PATCH con SOLO los campos que cambiaron (el backend valida contra el
 * estado resultante, y mandar de más sólo agrega ruido a la auditoría).
 * Devuelve los errores por campo si algún valor no es válido.
 */
export function buildServicePatch(
  form: ReservationForm,
  initial: ReservationForm,
): { patch: UpdateServiceInput } | { errors: FormErrors } {
  const errors: FormErrors = {};
  const patch: UpdateServiceInput = {};

  if (form.reservableSpots.trim() !== initial.reservableSpots.trim()) {
    if (form.reservableSpots.trim() === '') {
      patch.reservableSpots = null;
    } else {
      const spots = parseCapacityTotal(form.reservableSpots);
      if ('error' in spots) errors.reservableSpots = spots.error;
      else patch.reservableSpots = spots.total;
    }
  }

  const numeric: {
    field: 'approvalWindowMinutes' | 'lateCancelRefundPct';
    min: number;
    max: number;
  }[] = [
    { field: 'approvalWindowMinutes', min: 5, max: 120 },
    { field: 'lateCancelRefundPct', min: 0, max: 100 },
  ];
  for (const { field, min, max } of numeric) {
    if (form[field].trim() === initial[field].trim()) continue;
    const value = parseIntInRange(form[field], min, max);
    if (typeof value === 'string') errors[field] = value;
    else patch[field] = value;
  }

  // Duraciones con unidad (minutos|horas): se comparan y se mandan en minutos;
  // cambiar solo la unidad ("1 hora" → "60 minutos") no es un cambio.
  const freeCancel = durationToMinutes(
    form.freeCancelValue,
    form.freeCancelUnit,
  );
  if (typeof freeCancel !== 'number') {
    errors.freeCancelMinutes = freeCancel.error;
  } else if (
    freeCancel !==
    durationToMinutes(initial.freeCancelValue, initial.freeCancelUnit)
  ) {
    patch.freeCancelMinutes = freeCancel;
  }

  const grace = durationToMinutes(form.graceValue, form.graceUnit, GRACE_LIMIT);
  if (typeof grace !== 'number') {
    errors.graceMinutes = grace.error;
  } else if (
    grace !==
    durationToMinutes(initial.graceValue, initial.graceUnit, GRACE_LIMIT)
  ) {
    patch.graceMinutes = grace;
  }

  // Tope de la llegada anticipada: ya no hay "Llegada desde" editable. Si el
  // tope baja por debajo de la llegada normal actual, se baja ésta también
  // (`min(actual, tope)`) para que el backend no rechace por
  // SERVICE_EARLY_ARRIVAL_MAX_BELOW_EARLY.
  const maxMinutes = durationToMinutes(
    form.earlyArrivalMaxValue,
    form.earlyArrivalMaxUnit,
  );
  const initialMaxMinutes = durationToMinutes(
    initial.earlyArrivalMaxValue,
    initial.earlyArrivalMaxUnit,
  );
  if (typeof maxMinutes !== 'number') {
    errors.earlyArrivalMax = maxMinutes.error;
  } else {
    if (maxMinutes !== initialMaxMinutes) {
      patch.earlyArrivalMaxMinutes = maxMinutes;
    }
    const currentEarly = Number(form.earlyArrivalMinutes.trim());
    if (Number.isInteger(currentEarly) && maxMinutes < currentEarly) {
      patch.earlyArrivalMinutes = maxMinutes;
    }
  }

  if (form.rateId !== initial.rateId) {
    patch.reservationRateId = form.rateId === '' ? null : form.rateId;
  }
  if (form.acceptanceMode !== initial.acceptanceMode) {
    patch.acceptanceMode = form.acceptanceMode;
  }
  if (
    JSON.stringify([...form.categories].sort()) !==
    JSON.stringify([...initial.categories].sort())
  ) {
    patch.reservationVehicleCategories = [...form.categories];
  }

  return Object.keys(errors).length > 0 ? { errors } : { patch };
}

export function buildHoursPut(form: ReservationForm): ReservationHours {
  return {
    mode: form.hoursMode,
    ranges: form.hoursMode === 'custom' ? sortRanges(form.ranges) : [],
  };
}

// ------------------------------------------------------------------ guardado

export type SaveStep = 'hours' | 'config';

/**
 * Pasos de Guardar, en orden. Los horarios van primero: el backend los valida
 * contra el horario de apertura y es lo que más falla (400/422); así, si
 * fallan, no queda la configuración guardada a medias. Solo se incluye lo que
 * cambió.
 */
export function planSaveSteps(input: {
  hasPatch: boolean;
  hasHours: boolean;
}): SaveStep[] {
  const steps: SaveStep[] = [];
  if (input.hasHours) steps.push('hours');
  if (input.hasPatch) steps.push('config');
  return steps;
}

/** Activas pero el backend dice que ya no cumplen los requisitos. */
export function needsAttention(enabled: boolean, ready: boolean): boolean {
  return enabled && !ready;
}

// ---------------------------------------------------------------- checklist

export type ChecklistTarget =
  | { kind: 'route'; to: string }
  | { kind: 'section'; id: string };

export interface ChecklistItem {
  key: ReservationRequirement;
  label: string;
  ok: boolean;
  /** El último intento de activar falló por este requisito. */
  failed: boolean;
  target: ChecklistTarget;
}

const CHECKLIST: { key: ReservationRequirement; label: string }[] = [
  { key: 'mp_account', label: 'Mercado Pago vinculado' },
  { key: 'spots', label: 'Plazas reservables' },
  { key: 'hours', label: 'Horario' },
  { key: 'vehicles', label: 'Al menos un vehículo' },
  { key: 'rate', label: 'Tarifa activa' },
];

export const SECTION_IDS: Record<ReservationRequirement, string> = {
  mp_account: 'reservas-mp',
  spots: 'reservas-plazas',
  hours: 'reservas-horario',
  vehicles: 'reservas-vehiculos',
  rate: 'reservas-precio',
};

/**
 * Los 5 requisitos en el orden de la pantalla. `missing` viene del backend
 * (`readiness`); `failed` son los que marcó el último 422. Con
 * `markAllMissingFailed` (activas sin readiness) todo lo faltante figura fallido. Sin tarifas activas,
 * el link de "Tarifa activa" lleva a crear una en Tarifas.
 */
export function buildChecklist(
  missing: readonly ReservationRequirement[],
  failed: readonly ReservationRequirement[],
  hasActiveRates: boolean,
  markAllMissingFailed = false,
): ChecklistItem[] {
  return CHECKLIST.map(({ key, label }) => {
    const ok = !missing.includes(key);
    let target: ChecklistTarget = { kind: 'section', id: SECTION_IDS[key] };
    if (key === 'mp_account')
      target = { kind: 'route', to: '../../integraciones' };
    if (key === 'rate' && !hasActiveRates) {
      target = { kind: 'route', to: '../../tarifas' };
    }
    const isFailed = !ok && (markAllMissingFailed || failed.includes(key));
    return { key, label, ok, failed: isFailed, target };
  });
}

const REQUIREMENTS = new Set<string>(CHECKLIST.map((c) => c.key));

/** `missing` del 422 `SERVICE_RESERVATION_NOT_READY`, filtrado a valores conocidos. */
export function readMissingFromProblem(
  problem: unknown,
): ReservationRequirement[] {
  if (typeof problem !== 'object' || problem === null) return [];
  const missing = (problem as { missing?: unknown }).missing;
  if (!Array.isArray(missing)) return [];
  return missing.filter(
    (m): m is ReservationRequirement =>
      typeof m === 'string' && REQUIREMENTS.has(m),
  );
}

// ------------------------------------------------------------ precio y plazas

export interface PricePreviewRow {
  label: string;
  minutes: number;
  price: number;
}

const PREVIEW_STAYS = [
  { label: '1 h', minutes: 60 },
  { label: '1 h 30', minutes: 90 },
  { label: '3 h', minutes: 180 },
];

/** Lo que vería el conductor a 1 h, 1 h 30 y 3 h con la tarifa elegida. */
export function buildPricePreview(rate: Rate | undefined): PricePreviewRow[] {
  if (!rate) return [];
  const prices = {
    hour: rate.hourPriceArs,
    fraction: rate.fractionPriceArs,
    mediaEstadia: rate.mediaEstadiaPriceArs,
    stay: rate.stayPriceArs,
  };
  return PREVIEW_STAYS.map(({ label, minutes }) => ({
    label,
    minutes,
    price: calcStayPrice(minutes, prices),
  }));
}

export function formatArs(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

/** Descripción de la tarifa para el selector: "Por hora · $1.500/h + $125 cada 5 min". */
export function describeRate(rate: Rate): string {
  return `${rate.name} · ${formatArs(rate.hourPriceArs)}/h + ${formatArs(rate.fractionPriceArs)} cada 5 min`;
}

/**
 * "Las otras N siguen para quien llega sin reserva." Null si no hay una
 * cantidad válida o si supera la capacidad (el backend lo rechaza igual).
 */
export function unreservedSpotsText(
  capacityTotal: number | undefined,
  rawSpots: string,
): string | null {
  if (capacityTotal === undefined) return null;
  const spots = parseCapacityTotal(rawSpots);
  if ('error' in spots || spots.total > capacityTotal) return null;
  const rest = capacityTotal - spots.total;
  if (rest === 0) return 'No queda ninguna plaza para quien llega sin reserva.';
  return rest === 1
    ? 'La otra sigue para quien llega sin reserva.'
    : `Las otras ${rest} siguen para quien llega sin reserva.`;
}

// ------------------------------------------------- reservas vs. caja (aviso)

/**
 * Categorías reservables elegidas que NINGÚN tipo aceptado en caja cubre.
 *
 * Reservas y caja son independientes (no se bloquea nada), pero si el conductor
 * reserva una categoría que la caja no acepta, el operador no va a poder
 * registrar su ingreso. Es solo un aviso. Los tipos son los vivos del
 * estacionamiento.
 */
export function categoriesWithoutCashType(
  selected: readonly ReservationVehicleCategory[],
  types: readonly Pick<VehicleType, 'category' | 'accepted'>[],
): ReservationVehicleCategory[] {
  const acceptedCategories = new Set(
    types.filter((t) => t.accepted).map((t) => t.category),
  );
  return selected.filter((c) => !acceptedCategories.has(c));
}
