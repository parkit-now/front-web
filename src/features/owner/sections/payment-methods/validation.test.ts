import { describe, expect, it } from 'vitest';
import type { PaymentMethodSummary } from '../../services/entities';
import {
  paymentMethodToggleBlockReason,
  resolvePaymentMethodLock,
} from './validation';

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

describe('paymentMethodToggleBlockReason', () => {
  it('permite desactivar y reactivar un medio común no predeterminado', () => {
    expect(
      paymentMethodToggleBlockReason(makePaymentMethod(), false),
    ).toBeNull();
    expect(
      paymentMethodToggleBlockReason(
        makePaymentMethod({ enabled: false }),
        false,
      ),
    ).toBeNull();
  });
  it('protege el predeterminado si funciona normalmente', () => {
    expect(
      paymentMethodToggleBlockReason(
        makePaymentMethod({ isDefault: true }),
        false,
      ),
    ).toContain('predeterminado');
  });
  it('permite apagar un QR roto incluso si es predeterminado', () => {
    expect(
      paymentMethodToggleBlockReason(
        makePaymentMethod({ isDefault: true }),
        true,
      ),
    ).toBeNull();
  });
  it('impide reactivar un QR sin cuenta vinculada, sea o no predeterminado', () => {
    for (const isDefault of [false, true]) {
      expect(
        paymentMethodToggleBlockReason(
          makePaymentMethod({ enabled: false, isDefault }),
          true,
        ),
      ).toContain('vincular');
    }
  });
  it('permite recuperar un predeterminado inactivo si la integración está disponible', () => {
    expect(
      paymentMethodToggleBlockReason(
        makePaymentMethod({ enabled: false, isDefault: true }),
        false,
      ),
    ).toBeNull();
  });
});

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
