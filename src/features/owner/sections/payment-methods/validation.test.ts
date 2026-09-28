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
    invoiceMode: 'none',
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
    ).toEqual({
      integrationBacked: true,
      enableLocked: true,
      setDefaultLocked: true,
    });
  });

  it('deja editable el medio integrado con la cuenta vinculada', () => {
    const method = makePaymentMethod();
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'linked' }),
    ).toEqual({
      integrationBacked: true,
      enableLocked: false,
      setDefaultLocked: false,
    });
  });

  it('bloquea el medio integrado con la cuenta revocada', () => {
    const method = makePaymentMethod();
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'revoked' }),
    ).toEqual({
      integrationBacked: true,
      enableLocked: true,
      setDefaultLocked: true,
    });
  });

  it('nunca bloquea un medio común, mire como mire la cuenta', () => {
    const method = makePaymentMethod({ name: 'Efectivo', type: 'cash' });
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: null }),
    ).toEqual({
      integrationBacked: false,
      enableLocked: false,
      setDefaultLocked: false,
    });
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'revoked' }),
    ).toEqual({
      integrationBacked: false,
      enableLocked: false,
      setDefaultLocked: false,
    });
  });

  // El hueco que cerró esta regla: el interruptor ya estaba bloqueado, pero
  // "marcar como predeterminado" era otra puerta al mismo estado, y peor,
  // porque el predeterminado llega preseleccionado al modal de egreso.
  it('bloquea marcar como predeterminado un medio integrado con el token vencido', () => {
    const method = makePaymentMethod({ isDefault: false });
    expect(
      resolvePaymentMethodLock({
        type: method.type,
        accountStatus: 'token_expired',
      }).setDefaultLocked,
    ).toBe(true);
  });

  it('deja marcar como predeterminado el medio integrado con la cuenta vinculada', () => {
    const method = makePaymentMethod({ isDefault: false });
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'linked' })
        .setDefaultLocked,
    ).toBe(false);
  });

  it('nunca bloquea marcar como predeterminado un medio común', () => {
    const method = makePaymentMethod({ name: 'Efectivo', type: 'cash' });
    expect(
      resolvePaymentMethodLock({ type: method.type, accountStatus: 'revoked' })
        .setDefaultLocked,
    ).toBe(false);
  });
});
