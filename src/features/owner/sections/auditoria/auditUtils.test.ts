import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../../services/audit';
import {
  buildAuditRow,
  buildOwnerAuditRows,
  correctionComparisons,
  isOwnerAuditVisible,
  metadataEntries,
  paymentListLabel,
} from './auditUtils';

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: 'audit-1',
    action: 'entry.corrected',
    actorName: 'operador@parkit.test',
    createdAt: '2026-09-08T15:00:00.000Z',
    entityId: 'entry-1',
    entityType: 'entry',
    severity: 'warn',
    ...overrides,
  };
}

describe('audit utils', () => {
  it('maps entry.corrected metadata into a searchable row and comparison detail', () => {
    const row = buildAuditRow(
      event({
        metadata: {
          origin: 'history',
          actorRole: 'operator',
          reason: 'Error de tipeo',
          changedFields: ['plate', 'payments'],
          before: {
            plate: 'ABC123',
            amountPaid: 3000,
            color: 'Rojo',
            ticketNumber: 7,
            cashSessionId: 'cash-1',
            rateSnapshotName: 'Auto',
            vehicleBrand: 'Ford',
            vehicleModel: 'Focus',
            payments: [
              {
                id: 'pay-1',
                paymentMethodId: 'cash',
                paymentMethodName: 'Efectivo',
                amount: 3000,
              },
            ],
          },
          after: {
            plate: 'XYZ999',
            amountPaid: 5000,
            color: 'Azul',
            ticketNumber: 7,
            cashSessionId: 'cash-1',
            rateSnapshotName: 'Auto',
            vehicleBrand: 'Ford',
            vehicleModel: 'Focus',
            payments: [
              {
                id: 'pay-2',
                paymentMethodId: 'cash',
                paymentMethodName: 'Efectivo',
                amount: 3000,
              },
              {
                id: 'pay-3',
                paymentMethodId: 'mp',
                paymentMethodName: 'Mercado Pago',
                amount: 2000,
              },
            ],
          },
        },
      }),
    );

    expect(row.actionKind).toBe('entry.corrected');
    expect(row.originLabel).toBe('Historial');
    expect(row.plate).toBe('XYZ999');
    expect(row.ticketNumber).toBe('7');
    expect(row.moneyImpact).toBe('Cobrado $3.000 -> $5.000');
    expect(row.cashSessionId).toBe('cash-1');
    expect(row.paymentMethodNames).toEqual(['Efectivo', 'Mercado Pago']);
    expect(row.rateNames).toEqual(['Auto']);
    expect(row.vehicleBrands).toEqual(['Ford']);
    expect(row.vehicleModels).toEqual(['Focus']);
    expect(row.colors).toEqual(['Azul', 'Rojo']);
    expect(row.searchText).toContain('Error de tipeo');
    expect(row.searchText).toContain('payments');
    expect(row.searchText).toContain('Mercado Pago');

    const comparisons = correctionComparisons(row);
    expect(comparisons).toContainEqual(
      expect.objectContaining({
        field: 'Pagos',
        after: 'Efectivo: $3.000 · Mercado Pago: $2.000',
        changed: true,
      }),
    );
  });

  it('collapses rate snapshot fields into one Tarifa label', () => {
    const row = buildAuditRow(
      event({
        metadata: {
          origin: 'history',
          changedFields: [
            'rateId',
            'rateSnapshotName',
            'rateSnapshotHourPriceArs',
            'rateSnapshotStayPriceArs',
            'rateSnapshotFractionPriceArs',
            'plate',
          ],
          before: { plate: 'ABC123', rateSnapshotName: 'Pick up día' },
          after: { plate: 'ABC124', rateSnapshotName: 'Día Auto' },
        },
      }),
    );

    expect(row.changedFieldLabels).toEqual(['Tarifa', 'Patente']);
    expect(row.summary).toBe('Corrección de ABC124: Tarifa, Patente');
  });

  it('keeps suggested-only impact out of the impact column', () => {
    const row = buildAuditRow(
      event({
        metadata: {
          origin: 'history',
          changedFields: ['leftAt'],
          economicImpact: {
            suggestedBefore: 2000,
            suggestedAfter: 3000,
            suggestedDelta: 1000,
            chargedBefore: 2000,
            chargedAfter: 2000,
            chargedDelta: 0,
            deltaVsSuggestedAfter: 1000,
          },
          before: {
            plate: 'ABC123',
            amountPaid: 2000,
            leftAt: '2026-09-08T12:00:00.000Z',
          },
          after: {
            plate: 'ABC123',
            amountPaid: 2000,
            leftAt: '2026-09-08T13:00:00.000Z',
          },
        },
      }),
    );

    expect(row.moneyImpact).toBe('-');
    expect(row.impactAmount).toBeNull();
    expect(row.economicImpact?.deltaVsSuggestedAfter).toBe(1000);
  });

  it('detects active-entry corrections for the include base switch', () => {
    const row = buildAuditRow(
      event({
        metadata: {
          origin: 'history',
          changedFields: ['plate'],
          before: {
            plate: 'ABC123',
            enteredAt: '2026-09-08T12:00:00.000Z',
            leftAt: null,
          },
          after: {
            plate: 'ABC124',
            enteredAt: '2026-09-08T12:00:00.000Z',
            leftAt: null,
          },
        },
      }),
    );

    expect(row.isActiveEntry).toBe(true);
    expect(row.enteredAtLocalDate).toBe('2026-09-08');
    expect(row.leftAtLocalDate).toBe('');
  });

  it('shows charged economic impact for entry corrections', () => {
    const row = buildAuditRow(
      event({
        metadata: {
          origin: 'history',
          changedFields: ['payments'],
          economicImpact: {
            suggestedBefore: 3000,
            suggestedAfter: 3000,
            suggestedDelta: 0,
            chargedBefore: 3700,
            chargedAfter: 3800,
            chargedDelta: 100,
            deltaVsSuggestedAfter: -800,
          },
          before: { plate: 'ABC123', amountPaid: 3700 },
          after: { plate: 'ABC123', amountPaid: 3800 },
        },
      }),
    );

    expect(row.moneyImpact).toBe('Cobrado $3.700 -> $3.800');
    expect(row.impactAmount).toBe(100);
  });

  it('maps entry.undercharged metadata into anomaly impact', () => {
    const row = buildAuditRow(
      event({
        action: 'entry.undercharged',
        metadata: {
          origin: 'operational_exit',
          actorRole: 'operator',
          plate: 'AA123BB',
          ticketNumber: 12,
          suggestedAmount: 2000,
          chargedAmount: 1800,
          delta: 200,
        },
      }),
    );

    expect(row.actionLabel).toBe('Cobro menor al sugerido');
    expect(row.originLabel).toBe('Panel operativo');
    expect(row.summary).toBe('Cobro bajo en AA123BB: 90% del sugerido');
    expect(row.moneyImpact).toBe('Diferencia $200');
    expect(row.impactAmount).toBe(200);
  });

  it('keeps unknown generic events usable without exposing raw action text', () => {
    const row = buildAuditRow(
      event({
        action: 'unknown.vendor_warning',
        actorName: null,
        metadata: {
          status: 'needs_review',
          confidence: 0.698,
          internalId: 'x-1',
        },
        severity: 'warn',
      }),
    );

    expect(row.actionKind).toBe('other');
    expect(row.actionLabel).toBe('Evento del sistema');
    expect(row.actorName).toBe('Sistema');
    expect(row.plate).toBe('-');
    expect(row.reason).toBe('-');
    expect(row.summary).toBe('Evento del sistema');
    expect(metadataEntries(row)).toEqual([
      { key: 'Estado', value: 'needs review' },
      { key: 'Confianza', value: '70%' },
    ]);
  });

  it('filters owner audit rows to actionable events and keeps unknown generic warnings', () => {
    const rows = buildOwnerAuditRows([
      event({ id: 'rate', action: 'rate.prices_propagated' }),
      event({ id: 'lpr', action: 'lpr_event.dismissed' }),
      event({ id: 'profile', action: 'entity.profile_updated' }),
      event({ id: 'under', action: 'entry.undercharged' }),
      event({ id: 'mp', action: 'mp_account.token_expired' }),
      event({ id: 'unknown', action: 'unknown.vendor_warning' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['under', 'mp', 'unknown']);
    expect(isOwnerAuditVisible('rate.prices_propagated')).toBe(false);
    expect(isOwnerAuditVisible('lpr_event.dismissed')).toBe(false);
    expect(isOwnerAuditVisible('entity.profile_updated')).toBe(false);
    expect(isOwnerAuditVisible('unknown.vendor_warning')).toBe(true);
  });

  it('normalizes actionable integration labels and summaries', () => {
    const row = buildAuditRow(
      event({
        action: 'payment_intent.refunded',
        metadata: { amount: 2500, status: 'refunded', paymentIntentId: 'pi-1' },
        severity: 'crit',
      }),
    );

    expect(row.actionLabel).toBe('Pago devuelto por Mercado Pago');
    expect(row.summary).toBe('Mercado Pago devolvió $2.500');
    expect(metadataEntries(row)).toEqual([
      { key: 'Importe', value: '$2.500' },
      { key: 'Estado', value: 'refunded' },
      { key: 'Intento de pago', value: 'pi-1' },
    ]);
  });

  it('formats payment lines by method and amount', () => {
    expect(
      paymentListLabel([
        { paymentMethodName: 'Efectivo', amount: 3000 },
        { paymentMethodName: 'Mercado Pago', amount: 2000 },
      ]),
    ).toBe('Efectivo: $3.000 · Mercado Pago: $2.000');
  });

  it('cobro sin factura por certificado vencido: tipo propio, patente y monto sin sumar pérdida', () => {
    const row = buildAuditRow(
      event({
        action: 'invoice.cert_expired',
        metadata: {
          origin: 'operational_exit',
          plate: 'AE123BG',
          ticketNumber: 1,
          chargedAmount: 4200,
          invoiceId: 'inv-1',
        },
      }),
    );

    expect(row.actionKind).toBe('invoice.cert_expired');
    expect(row.actionLabel).toBe('Cobro sin factura');
    expect(row.summary).toBe(
      'Cobro sin factura en AE123BG: certificado de ARCA vencido',
    );
    expect(row.plate).toBe('AE123BG');
    expect(row.impactAmount).toBeNull();
  });

  it('los eventos de ARCA sin vista propia muestran un nombre legible', () => {
    const row = buildAuditRow(
      event({ action: 'arca_account.certificate_expired', severity: 'warn' }),
    );

    expect(row.actionKind).toBe('other');
    expect(row.actionLabel).toBe('Certificado de ARCA vencido');
  });
});
