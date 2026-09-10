import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../../services/audit';
import {
  buildAuditRow,
  correctionComparisons,
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

  it('keeps generic events usable when metadata is missing or unexpected', () => {
    const row = buildAuditRow(
      event({
        action: 'entity.profile_updated',
        actorName: null,
        metadata: null,
        severity: 'info',
      }),
    );

    expect(row.actionKind).toBe('other');
    expect(row.actorName).toBe('Sistema');
    expect(row.plate).toBe('-');
    expect(row.reason).toBe('-');
    expect(row.summary).toBe('entity.profile_updated');
  });

  it('formats payment lines by method and amount', () => {
    expect(
      paymentListLabel([
        { paymentMethodName: 'Efectivo', amount: 3000 },
        { paymentMethodName: 'Mercado Pago', amount: 2000 },
      ]),
    ).toBe('Efectivo: $3.000 · Mercado Pago: $2.000');
  });
});
