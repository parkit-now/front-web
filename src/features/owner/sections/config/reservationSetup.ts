import { calcStayPrice } from '../../../../shared/pricing/calcStayPrice';
import {
  SCHEDULE_DAYS,
  type ScheduleRange,
} from '../../../../shared/components/WeeklyScheduleEditor';
import type { Rate } from '../../services/rates';
import type {
  ReservationHours,
  ReservationRequirement,
  ReservationVehicleKind,
  ServiceItem,
  UpdateServiceInput,
} from '../../services/services';
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
  kinds: ReservationVehicleKind[];
  hoursMode: HoursMode;
  ranges: ScheduleRange[];
  rateId: string;
  acceptanceMode: AcceptanceMode;
  approvalWindowMinutes: string;
  freeCancelMinutes: string;
  lateCancelRefundPct: string;
  earlyArrivalMinutes: string;
  graceMinutes: string;
}

export const VEHICLE_KIND_OPTIONS: {
  id: ReservationVehicleKind;
  label: string;
}[] = [
  { id: 'car', label: 'Auto' },
  { id: 'suv_pickup', label: 'SUV / Pickup' },
  { id: 'motorcycle', label: 'Moto' },
];

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
    kinds: [...service.reservationVehicleKinds],
    hoursMode: hours.mode,
    ranges: sortRanges(hours.ranges),
    rateId: service.reservationRateId ?? '',
    acceptanceMode: service.acceptanceMode,
    approvalWindowMinutes: String(service.approvalWindowMinutes),
    freeCancelMinutes: String(service.freeCancelMinutes),
    lateCancelRefundPct: String(service.lateCancelRefundPct),
    earlyArrivalMinutes: String(service.earlyArrivalMinutes),
    graceMinutes: String(service.graceMinutes),
  };
}

/** En modo `opening` los rangos no cuentan: el backend los borra. */
function canonical(form: ReservationForm) {
  return {
    ...form,
    kinds: [...form.kinds].sort(),
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
  | 'earlyArrivalMinutes'
  | 'graceMinutes';

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
    field: Exclude<ReservationFormField, 'reservableSpots'>;
    min: number;
    max: number;
  }[] = [
    { field: 'approvalWindowMinutes', min: 5, max: 120 },
    { field: 'freeCancelMinutes', min: 0, max: 1440 },
    { field: 'lateCancelRefundPct', min: 0, max: 100 },
    { field: 'earlyArrivalMinutes', min: 0, max: 120 },
    { field: 'graceMinutes', min: 0, max: 180 },
  ];
  for (const { field, min, max } of numeric) {
    if (form[field].trim() === initial[field].trim()) continue;
    const value = parseIntInRange(form[field], min, max);
    if (typeof value === 'string') errors[field] = value;
    else patch[field] = value;
  }

  if (form.rateId !== initial.rateId) {
    patch.reservationRateId = form.rateId === '' ? null : form.rateId;
  }
  if (form.acceptanceMode !== initial.acceptanceMode) {
    patch.acceptanceMode = form.acceptanceMode;
  }
  if (
    JSON.stringify([...form.kinds].sort()) !==
    JSON.stringify([...initial.kinds].sort())
  ) {
    patch.reservationVehicleKinds = [...form.kinds];
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
      target = { kind: 'route', to: '../integraciones' };
    if (key === 'rate' && !hasActiveRates) {
      target = { kind: 'route', to: '../tasas' };
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
