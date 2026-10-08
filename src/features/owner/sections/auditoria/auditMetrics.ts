import type { AuditRow } from './auditUtils';

/**
 * Las métricas de arriba de Auditoría, y el filtro que abren al tocarlas.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 *
 * Antes el número de cada card se calculaba con lógica suelta adentro de un
 * `useMemo` de `AuditoriaPage.tsx`. Ahora esas cards además FILTRAN la tabla,
 * y eso hace que haya dos maneras de equivocarse: que el número diga 12 y
 * aparezcan 3 filas, o al revés.
 *
 * La única forma de que no pase es que el número y el filtro salgan de la
 * MISMA función. `metricMatches` decide si una fila entra; `computeRiskMetrics`
 * suma usando exactamente ese predicado. Si alguien cambia la regla, las dos
 * cosas se mueven juntas o no se mueve ninguna.
 *
 * Vive aparte y sin JSX porque en este repo los tests corren sin DOM: si la
 * lógica estuviera en el componente, no se podría testear.
 */

/** Qué card o barra está seleccionada. `null` = sin filtro, se ve todo. */
export type AuditMetricKey =
  /** Card: lo que se dejó de cobrar, por las dos causas juntas. */
  | 'possibleLoss'
  /** Card y barra: correcciones que bajaron el precio sugerido. */
  | 'suggestedReductionRisk'
  /** Barra: cobros por debajo del sugerido. */
  | 'underchargedLoss'
  /** Barra: correcciones que bajaron lo cobrado. */
  | 'chargeReductionLoss'
  /** Card: vive en la otra pestaña (patentes descartadas con buena lectura). */
  | 'suspiciousDismissals';

/**
 * Las que filtran la tabla de Eventos. `suspiciousDismissals` queda afuera a
 * propósito: sus datos están en la pestaña de Patentes, no en esta tabla.
 */
export type AuditEventMetricKey = Exclude<
  AuditMetricKey,
  'suspiciousDismissals'
>;

export function isEventMetric(key: AuditMetricKey): key is AuditEventMetricKey {
  return key !== 'suspiciousDismissals';
}

/**
 * Margen para comparar plata contra cero.
 *
 * Los deltas vienen de restas sobre decimales, así que un cambio que no movió
 * el precio puede quedar en -0,0000001 y contarse como una pérdida de un
 * centavo. Medio centavo es más chico que la unidad más chica que existe en
 * pesos, así que nada real cae adentro de esta ventana.
 */
const EPSILON = 0.005;

/** Lo que se dejó de cobrar en esta fila por cobrar menos que el sugerido. */
export function underchargedAmount(row: AuditRow): number {
  if (row.actionKind !== 'entry.undercharged') return 0;
  return Math.max(row.impactAmount ?? 0, 0);
}

/** Lo que se dejó de cobrar en esta fila por una corrección a la baja. */
export function chargeReductionAmount(row: AuditRow): number {
  if (row.actionKind !== 'entry.corrected') return 0;
  const delta = row.economicImpact?.chargedDelta ?? row.impactAmount ?? null;
  if (delta === null || delta >= -EPSILON) return 0;
  return Math.abs(delta);
}

/**
 * Cuánto bajó el PRECIO SUGERIDO en esta fila.
 *
 * No es plata perdida todavía: es que alguien cambió el horario o la tarifa de
 * una estadía y por eso el sistema ahora sugiere cobrar menos. Puede ser una
 * corrección legítima o la forma de justificar un cobro bajo, y por eso se
 * mide aparte en vez de sumarse a la pérdida.
 */
export function suggestedReductionAmount(row: AuditRow): number {
  if (row.actionKind !== 'entry.corrected') return 0;
  const delta = row.economicImpact?.suggestedDelta;
  if (delta === null || delta === undefined || delta >= -EPSILON) return 0;
  return Math.abs(delta);
}

/** Si esta fila es una de las que cuenta la métrica. */
export function metricMatches(
  row: AuditRow,
  key: AuditEventMetricKey,
): boolean {
  switch (key) {
    case 'underchargedLoss':
      return underchargedAmount(row) > 0;
    case 'chargeReductionLoss':
      return chargeReductionAmount(row) > 0;
    case 'suggestedReductionRisk':
      return suggestedReductionAmount(row) > 0;
    case 'possibleLoss':
      // La card de arriba: las dos causas de pérdida juntas. Una misma
      // corrección puede bajar lo cobrado Y el sugerido, así que una fila
      // puede entrar acá y además en la card de riesgo. No es doble conteo:
      // son dos preguntas distintas sobre el mismo hecho.
      return underchargedAmount(row) > 0 || chargeReductionAmount(row) > 0;
  }
}

/** Las filas que hay que mostrar cuando esa métrica está seleccionada. */
export function filterRowsByMetric(
  rows: AuditRow[],
  key: AuditEventMetricKey | null,
): AuditRow[] {
  if (key === null) return rows;
  return rows.filter((row) => metricMatches(row, key));
}

export type AuditRiskMetrics = {
  chargeReductionLoss: number;
  periodEvents: number;
  possibleLoss: number;
  suspiciousDismissals: number;
  suggestedReductionRisk: number;
  underchargedLoss: number;
};

/**
 * Los números de las cards, sobre las filas del PERÍODO auditado.
 *
 * Importa que entren `periodRows` y no las filas ya filtradas por la tabla: el
 * período es la autoridad y las cards lo resumen. Si las cards siguieran los
 * filtros de la tabla, tocar una card —que limpia esos filtros— cambiaría el
 * número justo cuando el usuario fue a buscarlo.
 */
export function computeRiskMetrics(
  periodRows: AuditRow[],
  suspiciousDismissals: number,
): AuditRiskMetrics {
  let underchargedLoss = 0;
  let chargeReductionLoss = 0;
  let suggestedReductionRisk = 0;

  periodRows.forEach((row) => {
    underchargedLoss += underchargedAmount(row);
    chargeReductionLoss += chargeReductionAmount(row);
    suggestedReductionRisk += suggestedReductionAmount(row);
  });

  return {
    chargeReductionLoss,
    periodEvents: periodRows.length,
    possibleLoss: underchargedLoss + chargeReductionLoss,
    suspiciousDismissals,
    suggestedReductionRisk,
    underchargedLoss,
  };
}
