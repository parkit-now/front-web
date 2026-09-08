import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../../services/audit';
import {
  buildAudit2Row,
  correctionComparisons,
  paymentListLabel,
} from './audit2Utils';

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

describe('audit2 utils', () => {
  it('maps entry.corrected metadata into a searchable row and comparison detail', () => {
    const row = buildAudit2Row(
      event({
        metadata: {
          origin: 'history',
          actorRole: 'operator',
          reason: 'Error de tipeo',
          changedFields: ['plate', 'payments'],
          before: {
            plate: 'ABC123',
            amountPaid: 3000,
            ticketNumber: 7,
            cashSessionId: 'cash-1',
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
            ticketNumber: 7,
            cashSessionId: 'cash-1',
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
    expect(row.moneyImpact).toBe('$3.000 -> $5.000');
    expect(row.searchText).toContain('Error de tipeo');
    expect(row.searchText).toContain('payments');

    const comparisons = correctionComparisons(row);
    expect(comparisons).toContainEqual(
      expect.objectContaining({
        field: 'Pagos',
        after: 'Efectivo: $3.000 · Mercado Pago: $2.000',
        changed: true,
      }),
    );
  });

  it('maps entry.undercharged metadata into anomaly impact', () => {
    const row = buildAudit2Row(
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
    const row = buildAudit2Row(
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
