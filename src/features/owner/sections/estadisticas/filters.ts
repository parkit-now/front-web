import type { DateRange } from '../../../../shared/components/ui/DateRangeFilter';
import {
  exceedsBucketLimit,
  localDayKey,
  presetRange,
  suggestGranularity,
  toArOffsetIso,
  type Granularity,
} from '../../../../shared/utils/ar-datetime';

export type PresetOption = 'hoy' | '7d' | '30d' | 'custom';

export const PRESET_LABELS: Record<PresetOption, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  custom: 'Personalizado',
};

export interface RangeInput {
  preset: PresetOption;
  /** Solo se usa con `preset: 'custom'`. */
  range: DateRange | undefined;
  /** 'HH:mm' en hora argentina. */
  fromTime: string;
  toTime: string;
}

export type ResolvedRange =
  | {
      ok: true;
      from: string;
      to: string;
      /** Granularidad sugerida; la UI deja cambiarla. */
      granularity: Granularity;
    }
  | { ok: false; reason: 'incomplete' | 'inverted' };


export function resolveRange(input: RangeInput, anchor: number): ResolvedRange {
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
