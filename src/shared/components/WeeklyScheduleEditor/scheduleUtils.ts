export type ScheduleDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface ScheduleRange {
  day: ScheduleDay;
  /** Minutos desde medianoche, 0..1439. */
  openMinute: number;
  /** Minutos desde medianoche, 1..1440 (1440 = medianoche de cierre). */
  closeMinute: number;
}

export const SCHEDULE_DAYS: { id: ScheduleDay; label: string }[] = [
  { id: 'monday', label: 'Lunes' },
  { id: 'tuesday', label: 'Martes' },
  { id: 'wednesday', label: 'Miércoles' },
  { id: 'thursday', label: 'Jueves' },
  { id: 'friday', label: 'Viernes' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
];

export const END_OF_DAY = 1440;
export const DEFAULT_RANGE = { openMinute: 8 * 60, closeMinute: 20 * 60 };

/**
 * Minutos desde medianoche -> "HH:mm". `<input type="time">` no puede
 * representar "24:00", así que el cierre a medianoche (1440) se muestra como
 * "00:00" (igual que en `ConfigHorarios`).
 */
export function minutesToTime(mins: number): string {
  const value = mins >= END_OF_DAY ? 0 : Math.max(0, mins);
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * "HH:mm" -> minutos. Un cierre "00:00" significa medianoche (1440), no 0.
 * Devuelve `null` si el texto no es una hora (input vaciado).
 */
export function timeToMinutes(value: string, isClose = false): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const mins = Number(match[1]) * 60 + Number(match[2]);
  return isClose && mins === 0 ? END_OF_DAY : mins;
}

export type ScheduleIssueKind = 'invalid_range' | 'overlap';

export interface ScheduleIssue {
  /** Índice de la franja problemática dentro del arreglo recibido. */
  index: number;
  kind: ScheduleIssueKind;
  /** Para `overlap`: índice de la franja con la que se pisa (la anterior). */
  overlapsWith?: number;
  message: string;
}

export const INVALID_RANGE_MESSAGE =
  'La hora de cierre debe ser posterior a la de apertura.';
export const OVERLAP_MESSAGE = 'Se superpone con otra franja de este día.';

/**
 * Espejo de `findScheduleIssues` del backend. Los intervalos son
 * semiabiertos [open, close): 08-12 y 12-20 son contiguos y NO se pisan. Una
 * franja inválida se reporta sólo como `invalid_range` y no entra al chequeo
 * de solapes.
 */
export function findScheduleIssues(
  ranges: readonly ScheduleRange[],
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const accepted: { index: number; range: ScheduleRange }[] = [];

  ranges.forEach((range, index) => {
    if (range.closeMinute <= range.openMinute) {
      issues.push({
        index,
        kind: 'invalid_range',
        message: INVALID_RANGE_MESSAGE,
      });
      return;
    }
    const clash = accepted.find(
      (other) =>
        other.range.day === range.day &&
        other.range.openMinute < range.closeMinute &&
        other.range.closeMinute > range.openMinute,
    );
    if (clash) {
      issues.push({
        index,
        kind: 'overlap',
        overlapsWith: clash.index,
        message: OVERLAP_MESSAGE,
      });
      return;
    }
    accepted.push({ index, range });
  });

  return issues;
}

export function hasScheduleIssues(ranges: readonly ScheduleRange[]): boolean {
  return findScheduleIssues(ranges).length > 0;
}

export function rangesOfDay(
  ranges: readonly ScheduleRange[],
  day: ScheduleDay,
): ScheduleRange[] {
  return ranges.filter((r) => r.day === day);
}

/** Cierra el día: quita todas sus franjas. */
export function closeDay(
  ranges: readonly ScheduleRange[],
  day: ScheduleDay,
): ScheduleRange[] {
  return ranges.filter((r) => r.day !== day);
}

/** Reemplaza las franjas del día por `next`, conservando el orden de días. */
export function setDayRanges(
  ranges: readonly ScheduleRange[],
  day: ScheduleDay,
  next: readonly Omit<ScheduleRange, 'day'>[],
): ScheduleRange[] {
  const order = SCHEDULE_DAYS.map((d) => d.id);
  const rest = ranges.filter((r) => r.day !== day);
  const merged = [...rest, ...next.map((r) => ({ ...r, day }))];
  return merged
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) => order.indexOf(a.r.day) - order.indexOf(b.r.day) || a.i - b.i,
    )
    .map(({ r }) => r);
}

/** Abierto las 24 hs (0 a 1440) ese día. */
export function setDay24h(
  ranges: readonly ScheduleRange[],
  day: ScheduleDay,
): ScheduleRange[] {
  return setDayRanges(ranges, day, [
    { openMinute: 0, closeMinute: END_OF_DAY },
  ]);
}

/** Copia las franjas del `source` a todos los demás días. */
export function copyDayToAll(
  ranges: readonly ScheduleRange[],
  source: ScheduleDay,
): ScheduleRange[] {
  const template = rangesOfDay(ranges, source);
  return SCHEDULE_DAYS.flatMap(({ id }) =>
    id === source ? template : template.map((r) => ({ ...r, day: id })),
  );
}

/**
 * Franja por defecto al agregar: 08-20 si el día está vacío; si ya tiene
 * franjas, una hora a partir del último cierre (acotada al fin del día).
 */
export function nextDefaultRange(
  existing: readonly ScheduleRange[],
): Omit<ScheduleRange, 'day'> {
  if (existing.length === 0) return { ...DEFAULT_RANGE };
  const lastClose = Math.max(...existing.map((r) => r.closeMinute));
  const open = Math.min(lastClose, END_OF_DAY - 60);
  return { openMinute: open, closeMinute: Math.min(open + 60, END_OF_DAY) };
}

export function is24h(
  range: Pick<ScheduleRange, 'openMinute' | 'closeMinute'>,
) {
  return range.openMinute === 0 && range.closeMinute === END_OF_DAY;
}
