import type { DateRange } from '../../../../shared/components/ui/DateRangeFilter';
import {
  exceedsBucketLimit,
  localDayKey,
  presetRange,
  suggestGranularity,
  toArOffsetIso,
  type Granularity,
} from '../../../../shared/utils/ar-datetime';

export type PresetOption = 'hoy' | '7d' | '30d' | 'custom' | 'caja';

export const PRESET_LABELS: Record<PresetOption, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  custom: 'Personalizado',
  caja: 'Por caja',
};

/**
 * Turno de caja elegido, para el modo `'caja'`. `closedAt` falta mientras el
 * turno sigue abierto.
 */
export interface CashSessionWindow {
  id: string;
  openedAt: string;
  closedAt?: string;
}

export interface RangeInput {
  preset: PresetOption;
  /** Solo se usa con `preset: 'custom'`. */
  range: DateRange | undefined;
  /** 'HH:mm' en hora argentina. */
  fromTime: string;
  toTime: string;
  /** Solo se usa con `preset: 'caja'`. */
  cashSession?: CashSessionWindow;
}

export type ResolvedRange =
  | {
      ok: true;
      from: string;
      to: string;
      /** Granularidad sugerida; la UI deja cambiarla. */
      granularity: Granularity;
      /**
       * Presente en modo caja. Ahí `from`/`to` son la ventana **nominal** del
       * turno y sirven solo para decidir la granularidad: al backend se manda
       * únicamente la caja, que deriva la ventana efectiva ensanchándola para
       * cubrir los cobros sincronizados tarde. Esa vuelve en la respuesta.
       */
      cashSessionId?: string;
    }
  | { ok: false; reason: 'incomplete' | 'inverted' | 'no-session' };

export function resolveRange(input: RangeInput, anchor: number): ResolvedRange {
  if (input.preset === 'caja') {
    const session = input.cashSession;
    if (!session) return { ok: false, reason: 'no-session' };

    // El turno abierto no tiene cierre: se corta en el ancla, igual que los
    // presets, para que la ventana no cambie en cada render.
    const from = session.openedAt;
    const to = session.closedAt ?? new Date(anchor).toISOString();

    return {
      ok: true,
      from,
      to,
      granularity: suggestGranularity(from, to),
      cashSessionId: session.id,
    };
  }

  if (input.preset !== 'custom') {
    const { from, to, granularity } = presetRange(
      input.preset,
      new Date(anchor),
    );
    return { ok: true, from, to, granularity };
  }

  const start = input.range?.from;
  if (!start) return { ok: false, reason: 'incomplete' };
  // Un solo día elegido = ese día, de `fromTime` a `toTime`.
  const end = input.range?.to ?? start;

  const from = toArOffsetIso(localDayKey(start), input.fromTime);
  const to = toArOffsetIso(localDayKey(end), input.toTime);

  if (new Date(from).getTime() >= new Date(to).getTime()) {
    return { ok: false, reason: 'inverted' };
  }

  return { ok: true, from, to, granularity: suggestGranularity(from, to) };
}

/**
 * La granularidad elegida a mano puede pedir más buckets de los que el backend
 * devuelve (tope 1000), que responde 400. Se avisa antes de disparar.
 */
export function granularityIsTooFine(
  resolved: ResolvedRange,
  granularity: Granularity,
): boolean {
  if (!resolved.ok) return false;
  return exceedsBucketLimit(resolved.from, resolved.to, granularity);
}

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  hour: 'Por hora',
  day: 'Por día',
  week: 'Por semana',
  month: 'Por mes',
};

const GRANULARITY_ORDER: Granularity[] = ['hour', 'day', 'week', 'month'];

/**
 * Tope de la agrupación por hora.
 *
 * El backend aguanta hasta 1000 buckets, o sea ~41 días de barras horarias: el
 * gráfico entra pero no se lee. Dos días de turnos (más el margen de un rango
 * que arranca y termina a media tarde) es lo último que sigue siendo útil.
 */
export const HOUR_MAX_SPAN_HOURS = 50;

export function hourGranularityAllowed(resolved: ResolvedRange): boolean {
  if (!resolved.ok) return false;
  const spanMs =
    new Date(resolved.to).getTime() - new Date(resolved.from).getTime();
  return spanMs <= HOUR_MAX_SPAN_HOURS * 3_600_000;
}

/** Las opciones que la UI ofrece para el rango ya resuelto. */
export function availableGranularities(resolved: ResolvedRange): Granularity[] {
  return hourGranularityAllowed(resolved)
    ? GRANULARITY_ORDER
    : GRANULARITY_ORDER.filter((option) => option !== 'hour');
}

/**
 * Degrada la granularidad elegida a mano cuando el rango dejó de admitirla.
 *
 * Hace falta además del `<option disabled>`: la elección manual sobrevive al
 * ensanchado de un rango personalizado, así que sin el clamp un usuario que
 * eligió "por hora" en un día y después estiró el rango a un mes seguiría
 * pidiendo horas.
 */
export function clampGranularity(
  resolved: ResolvedRange,
  wanted: Granularity,
): Granularity {
  if (wanted === 'hour' && !hourGranularityAllowed(resolved)) return 'day';
  return wanted;
}

/**
 * El filtro `vehicleType` es texto libre (máx. 60), no un enum: se compara
 * contra `entries.vehicleType`, que es el **nombre que el tipo tenía al momento
 * del ingreso**, no una referencia viva al catálogo.
 *
 * Consecuencia: si el dueño renombra un tipo, las estadías viejas conservan el
 * nombre anterior y el catálogo actual ya no las matchea. Un valor que no existe
 * devuelve 200 con resultado vacío, no un 400, así que el desajuste se ve como
 * "sin datos" y hay que avisarlo en la UI.
 */
export const VEHICLE_TYPE_MAX_LENGTH = 60;
