import { describe, expect, it } from 'vitest';
import type { AuditRow } from './auditUtils';
import {
  chargeReductionAmount,
  computeRiskMetrics,
  filterRowsByMetric,
  isEventMetric,
  metricMatches,
  suggestedReductionAmount,
  underchargedAmount,
} from './auditMetrics';

/**
 * El invariante que estos tests protegen: **el número de la card tiene que ser
 * igual a la cantidad de filas que aparecen al tocarla.**
 *
 * Es lo único que hace creíble a la pantalla. Si la card dice 12 y aparecen 3
 * filas, el dueño deja de confiar en los dos números.
 */

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    actionKind: 'other',
    impactAmount: null,
    economicImpact: null,
    ...overrides,
  } as AuditRow;
}

const cobroBajo = row({ actionKind: 'entry.undercharged', impactAmount: 500 });
const correccionBajaCobro = row({
  actionKind: 'entry.corrected',
  economicImpact: { chargedDelta: -300 } as AuditRow['economicImpact'],
});
const correccionBajaSugerido = row({
  actionKind: 'entry.corrected',
  economicImpact: { suggestedDelta: -200 } as AuditRow['economicImpact'],
});
const correccionQueSube = row({
  actionKind: 'entry.corrected',
  economicImpact: {
    chargedDelta: 400,
    suggestedDelta: 400,
  } as AuditRow['economicImpact'],
});
const eventoCualquiera = row();

describe('importes por fila', () => {
  it('un cobro bajo el sugerido cuenta su impacto', () => {
    expect(underchargedAmount(cobroBajo)).toBe(500);
  });

  it('una corrección que BAJA lo cobrado cuenta el valor absoluto', () => {
    expect(chargeReductionAmount(correccionBajaCobro)).toBe(300);
  });

  it('una corrección que SUBE lo cobrado no es pérdida', () => {
    expect(chargeReductionAmount(correccionQueSube)).toBe(0);
    expect(suggestedReductionAmount(correccionQueSube)).toBe(0);
  });

  it('un impacto negativo en un cobro bajo no se cuenta como ganancia', () => {
    expect(
      underchargedAmount(
        row({ actionKind: 'entry.undercharged', impactAmount: -100 }),
      ),
    ).toBe(0);
  });

  it('un delta de medio centavo no cuenta como pérdida', () => {
    // Vienen de restas sobre decimales: sin el margen, un cambio que no movió
    // el precio aparecería como una pérdida de un centavo.
    const ruido = row({
      actionKind: 'entry.corrected',
      economicImpact: { chargedDelta: -0.001 } as AuditRow['economicImpact'],
    });
    expect(chargeReductionAmount(ruido)).toBe(0);
  });

  it('sin economicImpact cae al impactAmount', () => {
    const vieja = row({ actionKind: 'entry.corrected', impactAmount: -250 });
    expect(chargeReductionAmount(vieja)).toBe(250);
  });
});

describe('metricMatches', () => {
  it('"pérdida posible" junta las DOS causas', () => {
    expect(metricMatches(cobroBajo, 'possibleLoss')).toBe(true);
    expect(metricMatches(correccionBajaCobro, 'possibleLoss')).toBe(true);
  });

  it('"pérdida posible" NO incluye un sugerido a la baja sin cobro menor', () => {
    // Bajar el sugerido todavía no es plata perdida: es riesgo, y tiene su
    // propia card.
    expect(metricMatches(correccionBajaSugerido, 'possibleLoss')).toBe(false);
    expect(
      metricMatches(correccionBajaSugerido, 'suggestedReductionRisk'),
    ).toBe(true);
  });

  it('las barras son cortes más finos que la card', () => {
    expect(metricMatches(cobroBajo, 'underchargedLoss')).toBe(true);
    expect(metricMatches(cobroBajo, 'chargeReductionLoss')).toBe(false);
    expect(metricMatches(correccionBajaCobro, 'chargeReductionLoss')).toBe(
      true,
    );
    expect(metricMatches(correccionBajaCobro, 'underchargedLoss')).toBe(false);
  });

  it('un evento sin impacto económico no entra en ninguna', () => {
    for (const key of [
      'possibleLoss',
      'suggestedReductionRisk',
      'underchargedLoss',
      'chargeReductionLoss',
    ] as const) {
      expect(metricMatches(eventoCualquiera, key)).toBe(false);
    }
  });
});

describe('el número de la card coincide con las filas que muestra', () => {
  const filas = [
    cobroBajo,
    correccionBajaCobro,
    correccionBajaSugerido,
    correccionQueSube,
    eventoCualquiera,
  ];

  it('pérdida posible: 2 filas y $800', () => {
    const metrics = computeRiskMetrics(filas, 0);
    expect(metrics.possibleLoss).toBe(800);
    expect(filterRowsByMetric(filas, 'possibleLoss')).toHaveLength(2);
  });

  it('cada barra filtra exactamente las filas que sumó', () => {
    const metrics = computeRiskMetrics(filas, 0);
    expect(metrics.underchargedLoss).toBe(500);
    expect(filterRowsByMetric(filas, 'underchargedLoss')).toEqual([cobroBajo]);
    expect(metrics.chargeReductionLoss).toBe(300);
    expect(filterRowsByMetric(filas, 'chargeReductionLoss')).toEqual([
      correccionBajaCobro,
    ]);
    expect(metrics.suggestedReductionRisk).toBe(200);
    expect(filterRowsByMetric(filas, 'suggestedReductionRisk')).toEqual([
      correccionBajaSugerido,
    ]);
  });

  it('una métrica en cero no filtra ninguna fila', () => {
    const solo = [eventoCualquiera, correccionQueSube];
    const metrics = computeRiskMetrics(solo, 0);
    expect(metrics.possibleLoss).toBe(0);
    expect(filterRowsByMetric(solo, 'possibleLoss')).toEqual([]);
  });

  it('las dos barras de pérdida suman exactamente la card', () => {
    const metrics = computeRiskMetrics(filas, 0);
    expect(metrics.underchargedLoss + metrics.chargeReductionLoss).toBe(
      metrics.possibleLoss,
    );
  });

  it('"eventos auditables" es el total del período, sin filtrar', () => {
    expect(computeRiskMetrics(filas, 0).periodEvents).toBe(5);
  });

  it('sin métrica seleccionada se devuelven todas', () => {
    expect(filterRowsByMetric(filas, null)).toEqual(filas);
  });

  it('una métrica en cero no tiene filas: por eso la card se deshabilita', () => {
    // El invariante al revés. Si el número es 0 y el filtro igual devolviera
    // filas, deshabilitar la card estaría escondiendo datos.
    const sinPerdidas = [correccionQueSube, eventoCualquiera];
    const metrics = computeRiskMetrics(sinPerdidas, 0);

    expect(metrics.possibleLoss).toBe(0);
    expect(metrics.underchargedLoss).toBe(0);
    expect(metrics.chargeReductionLoss).toBe(0);
    expect(metrics.suggestedReductionRisk).toBe(0);

    for (const key of [
      'possibleLoss',
      'underchargedLoss',
      'chargeReductionLoss',
      'suggestedReductionRisk',
    ] as const) {
      expect(filterRowsByMetric(sinPerdidas, key)).toEqual([]);
    }
  });

  it('el desglose cierra: las barras suman el total del encabezado', () => {
    // El riesgo por horario/tarifa NO entra en esa suma, y por eso su barra
    // salió del desglose: quedaba debajo de un total al que no aportaba.
    const metrics = computeRiskMetrics(filas, 0);
    expect(metrics.underchargedLoss + metrics.chargeReductionLoss).toBe(
      metrics.possibleLoss,
    );
    expect(metrics.suggestedReductionRisk).toBeGreaterThan(0);
    expect(metrics.possibleLoss).not.toBe(
      metrics.possibleLoss + metrics.suggestedReductionRisk,
    );
  });
});

describe('isEventMetric', () => {
  it('los descartes sospechosos NO filtran la tabla de eventos', () => {
    // Sus datos viven en la pestaña de Patentes: por eso tocarla salta de
    // pestaña en vez de filtrar acá.
    expect(isEventMetric('suspiciousDismissals')).toBe(false);
  });

  it('el resto sí', () => {
    expect(isEventMetric('possibleLoss')).toBe(true);
    expect(isEventMetric('underchargedLoss')).toBe(true);
  });
});
