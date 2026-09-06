export const AR_TZ = 'America/Argentina/Buenos_Aires';
export const AR_OFFSET = '-03:00';

export const MAX_BUCKETS = 1000;

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export type RangePreset = 'hoy' | '7d' | '30d';

export interface MetricsRange {
  from: string;
  to: string;
  granularity: Granularity;
}

const DAY_MS = 86_400_000;

const AR_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: AR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function arDayKey(instant: Date = new Date()): string {
  return AR_DAY_FORMAT.format(instant);
}

export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(
    Date.UTC(year, month - 1, day, 12) + deltaDays * DAY_MS,
  );
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function toArOffsetIso(dayKey: string, time = '00:00'): string {
  // Aceptamos 'HH:mm' y 'HH:mm:ss'; normalizamos a segundos para el backend.
  const withSeconds = time.length === 5 ? `${time}:00` : time;
  return `${dayKey}T${withSeconds}${AR_OFFSET}`;
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function arMonthStartDayKey(instant: Date = new Date()): string {
  return `${arDayKey(instant).slice(0, 7)}-01`;
}

export function presetRange(
  preset: RangePreset,
  now: Date = new Date(),
): MetricsRange {
  const today = arDayKey(now);
  const to = now.toISOString();

  if (preset === 'hoy') {
    return { from: toArOffsetIso(today), to, granularity: 'hour' };
  }
  const backDays = preset === '7d' ? 6 : 29;
  return {
    from: toArOffsetIso(shiftDayKey(today, -backDays)),
    to,
    granularity: 'day',
  };
}

export function monthToDateRange(now: Date = new Date()): MetricsRange {
  return {
    from: toArOffsetIso(arMonthStartDayKey(now)),
    to: toArOffsetIso(arDayKey(now), '23:59:59'),
    granularity: 'day',
  };
}

const GRANULARITY_MS: Record<Granularity, number> = {
  hour: 3_600_000,
  day: DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
};

export function estimateBuckets(
  from: string,
  to: string,
  granularity: Granularity,
): number {
  const spanMs = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(spanMs) || spanMs <= 0) return 0;
  return Math.ceil(spanMs / GRANULARITY_MS[granularity]);
}

export function exceedsBucketLimit(
  from: string,
  to: string,
  granularity: Granularity,
): boolean {
  return estimateBuckets(from, to, granularity) > MAX_BUCKETS;
}

export function suggestGranularity(from: string, to: string): Granularity {
  const spanMs = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(spanMs) || spanMs <= 0) return 'day';

  const spanDays = spanMs / DAY_MS;
  if (spanDays <= 2) return 'hour';
  if (spanDays <= 92) return 'day';
  if (spanDays <= 730) return 'week';
  return 'month';
}
