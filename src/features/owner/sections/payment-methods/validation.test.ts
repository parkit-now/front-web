import { describe, expect, it } from 'vitest';
import type { PaymentMethodSummary } from '../../services/entities';
import { resolvePaymentMethodLock } from './validation';

function makePaymentMethod(
  overrides: Partial<PaymentMethodSummary> = {},
): PaymentMethodSummary {
  return {
    id: 'pm-1',
    name: 'Mercado Pago QR',
    type: 'mercadopago_qr',
    enabled: true,
    isDefault: false,
    isSystem: true,
    syncSeq: 1,
    version: 1,
    createdAt: '2026-09-20T12:49:00.000Z',
    updatedAt: '2026-09-20T12:49:00.000Z',
    ...overrides,
  };
}

describe('resolvePaymentMethodLock', () => {
  it('bloquea el medio integrado cuando no hay cuenta vinculada', () => {
    const method = makePaymentMethod();
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: null }),
    ).toEqual({ integrationBacked: true, toggleLocked: true });
  });

  it('deja editable el medio integrado con la cuenta vinculada', () => {
    const method = makePaymentMethod();
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'linked' }),
    ).toEqual({ integrationBacked: true, toggleLocked: false });
  });

  it('bloquea el medio integrado con la cuenta revocada', () => {
    const method = makePaymentMethod();
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'revoked' }),
    ).toEqual({ integrationBacked: true, toggleLocked: true });
  });

  it('nunca bloquea un medio común, mire como mire la cuenta', () => {
    const method = makePaymentMethod({ name: 'Efectivo', type: 'cash' });
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: null }),
    ).toEqual({ integrationBacked: false, toggleLocked: false });
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'revoked' }),
    ).toEqual({ integrationBacked: false, toggleLocked: false });
  });
});
