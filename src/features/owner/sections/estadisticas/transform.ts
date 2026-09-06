import type {
  PaymentMethodBreakdown,
  TopPlate,
  TopPlatesOrderBy,
} from '../../services/metrics';
import type { Granularity } from '../../../../shared/utils/ar-datetime';

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
