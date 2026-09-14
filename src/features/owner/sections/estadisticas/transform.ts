import type {
  PaymentMethodBreakdown,
  TopPlate,
  TopPlatesOrderBy,
} from '../../services/metrics';
import { AR_TZ, type Granularity } from '../../../../shared/utils/ar-datetime';

const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

/**
 * Etiqueta del eje X a partir del `key` del bucket.
 *
 * El backend rotula: `YYYY-MM-DDTHH` (hora), `YYYY-MM-DD` (día, y la semana por
 * su lunes) y `YYYY-MM` (mes). Se parsea el string a mano a propósito: pasarlo
 * por `new Date()` lo reinterpretaría en el huso del navegador y correría las
 * etiquetas un día.
 */
export function formatBucketLabel(
  key: string,
  granularity: Granularity,
): string {
  if (granularity === 'month') {
    const month = Number(key.slice(5, 7));
    return MONTHS_SHORT[month - 1] ?? key;
  }
  if (granularity === 'hour') {
    return `${key.slice(11, 13)}h`;
  }
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

const AR_SHORT = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: AR_TZ,
});

/**
 * Día y hora argentinos de un instante, ya separados.
 *
 * Se arma por partes porque `es-AR` no rellena el mes con cero cuando solo se
 * piden día y mes (`10/9`, no `10/09`), y las etiquetas del `<select>` quedan
 * desalineadas.
 */
function arShortParts(value: string): { day: string; time: string } {
  const parts = AR_SHORT.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((part) => part.type === type)?.value ?? '').padStart(2, '0');

  return {
    day: `${get('day')}/${get('month')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/**
 * Ventana en hora argentina: "10/09 08:00 → 20:00". Sin `to`, "→ abierta".
 *
 * El día del final se repite solo cuando la ventana cruzó la medianoche, que es
 * justo el caso en el que omitirlo confundiría.
 */
export function formatWindowLabel(from: string, to?: string): string {
  const start = arShortParts(from);
  const head = `${start.day} ${start.time}`;

  if (!to) return `${head} → abierta`;

  const end = arShortParts(to);

  return end.day === start.day
    ? `${head} → ${end.time}`
    : `${head} → ${end.day} ${end.time}`;
}

/** Etiqueta de un turno de caja en el `<select>`. */
export function formatCashSessionLabel(session: {
  openedAt: string;
  closedAt?: string;
}): string {
  return formatWindowLabel(session.openedAt, session.closedAt);
}

export interface AxisScale {
  /** Techo del eje: el valor del tick más alto, contra el que se escalan las barras. */
  top: number;
  /** Ticks ascendentes, de 0 a `top` inclusive. */
  ticks: number[];
}

/**
 * Escala "redonda" para el eje Y.
 *
 * Escalar contra el máximo crudo deja el tope en cifras como 47.312, que no
 * sirven de referencia. Se redondea el paso a 1, 2 o 5 por década y el techo al
 * primer múltiplo de ese paso que cubra la serie.
 */
export function niceTicks(max: number, count = 4): AxisScale {
  if (!Number.isFinite(max) || max <= 0) return { top: 1, ticks: [0, 1] };

  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceFactor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  // Una serie de enteros (autos, visitas) no puede tener medios en el eje.
  const step = Math.max(niceFactor * magnitude, Number.isInteger(max) ? 1 : 0);

  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Se cuenta en pasos enteros para no arrastrar el error de coma flotante.
  for (let i = 0; i * step <= top + step / 2; i += 1) {
    ticks.push(Number((i * step).toPrecision(12)));
  }

  return { top: ticks[ticks.length - 1], ticks };
}

/**
 * Etiqueta compacta del eje Y. Se abrevia con `k`/`M` en vez del `"45 mil"` que
 * devuelve `Intl` en es-AR: no entra en el canal del eje.
 */
export function formatAxisValue(
  value: number,
  kind: 'money' | 'count',
): string {
  const prefix = kind === 'money' ? '$' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${prefix}${trimNumber(value / 1_000_000)} M`;
  if (abs >= 1_000) return `${prefix}${trimNumber(value / 1_000)} k`;
  return `${prefix}${trimNumber(value)}`;
}

/** Un decimal como mucho, con coma, y sin el `,0` de los enteros. */
function trimNumber(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

export interface PieSlice {
  name: string;
  amount: number;
  /** Proporción sobre el total, 0–1. */
  share: number;
  /** Recaudación sin método asociado. */
  isUnallocated: boolean;
}

export const UNALLOCATED_LABEL = 'Sin detalle';

/**
 * Porciones de la torta, incluyendo `unallocated` como una más.
 *
 * Sin esa porción las tajadas no suman el total del KPI y el gráfico parece
 * roto: al cerrar una estadía se puede mandar `amountPaid` directo sin detalle
 * de pagos, y esa plata queda en el total sin método.
 */
export function buildPieSlices(breakdown: PaymentMethodBreakdown): PieSlice[] {
  const slices: PieSlice[] = breakdown.methods.map((method) => ({
    name: method.name,
    amount: method.amount,
    share: method.share,
    isUnallocated: false,
  }));

  if (breakdown.unallocated > 0) {
    slices.push({
      name: UNALLOCATED_LABEL,
      amount: breakdown.unallocated,
      share: breakdown.total > 0 ? breakdown.unallocated / breakdown.total : 0,
      isUnallocated: true,
    });
  }

  return slices;
}

/**
 * Un `unallocated` negativo significa que las transacciones superan lo
 * registrado en las estadías: es una inconsistencia de datos que conviene
 * mostrar, no un error de renderizado.
 */
export function hasInconsistentUnallocated(
  breakdown: PaymentMethodBreakdown,
): boolean {
  return breakdown.unallocated < 0;
}

const ORDER_FIELD: Record<TopPlatesOrderBy, keyof TopPlate> = {
  revenue: 'revenue',
  visits: 'visits',
  duration: 'totalMinutes',
};

/**
 * Reordena el top de patentes en cliente. Las tres métricas vienen siempre en
 * la respuesta, así que cambiar el criterio no necesita otra request.
 */
export function sortTopPlates(
  items: TopPlate[],
  orderBy: TopPlatesOrderBy,
): TopPlate[] {
  const field = ORDER_FIELD[orderBy];
  return [...items].sort((a, b) => Number(b[field]) - Number(a[field]));
}

/** 545 -> "9h 5m"; 45 -> "45m". */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}
