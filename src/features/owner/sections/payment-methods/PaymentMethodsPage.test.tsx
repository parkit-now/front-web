// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type { PaymentMethodSummary } from '../../services/entities';
import { PaymentMethodsPage } from './PaymentMethodsPage';

const entities = vi.hoisted(() => ({
  listPaymentMethods: vi.fn(),
  createPaymentMethod: vi.fn(),
  togglePaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
}));
const mp = vi.hoisted(() => ({ getMpAccount: vi.fn() }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: 'owner' },
  }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user',
}));
vi.mock('../../services/entities', () => entities);
vi.mock('../../services/mercado-pago', () => mp);

const NOW = '2026-10-07T15:00:00.000Z';

function method(
  overrides: Partial<PaymentMethodSummary> = {},
): PaymentMethodSummary {
  return {
    id: 'efectivo',
    name: 'Efectivo',
    type: 'cash',
    enabled: true,
    isDefault: true,
    isSystem: true,
    invoiceMode: 'none',
    createdAt: NOW,
    updatedAt: NOW,
    syncSeq: 1,
    version: 1,
    ...overrides,
  };
}

describe('PaymentMethodsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    entities.listPaymentMethods.mockResolvedValue([
      method(),
      method({
        id: 'transfer',
        name: 'Transferencia',
        type: 'transfer',
        isDefault: false,
        isSystem: false,
      }),
      method({
        id: 'qr',
        name: 'Mercado Pago QR',
        type: 'mercadopago_qr',
        isDefault: false,
        isSystem: true,
        enabled: false,
      }),
    ]);
    entities.createPaymentMethod.mockResolvedValue(method({ id: 'nuevo' }));
    entities.togglePaymentMethod.mockResolvedValue(method());
    entities.deletePaymentMethod.mockResolvedValue(undefined);
    mp.getMpAccount.mockRejectedValue(new ApiError(404, 'Not Found', null));
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista los métodos y marca los de sistema', async () => {
    await mount(<PaymentMethodsPage />);

    expect(pageText()).toContain('Efectivo');
    expect(pageText()).toContain('Transferencia');
    expect(pageText()).toContain('Sistema');
  });

  it('agrega un método de pago', async () => {
    await mount(<PaymentMethodsPage />);

    await click('Agregar método de pago');
    await change(field('Nombre *'), 'Cheque');
    await click('Crear');

    expect(entities.createPaymentMethod).toHaveBeenCalledWith('tenant', {
      name: 'Cheque',
    });
  });

  it('renombra un método', async () => {
    await mount(<PaymentMethodsPage />);

    await click('Editar Transferencia');
    await change(field('Nombre *'), 'Transferencia bancaria');
    await click('Guardar cambios');

    expect(entities.togglePaymentMethod).toHaveBeenCalledWith(
      'tenant',
      'transfer',
      { name: 'Transferencia bancaria' },
    );
  });

  it('desactiva un método después de confirmar', async () => {
    await mount(<PaymentMethodsPage />);

    await click('Desactivar Transferencia');
    await click('Desactivar');

    expect(entities.togglePaymentMethod).toHaveBeenCalledWith(
      'tenant',
      'transfer',
      { enabled: false },
    );
  });

  it('marca un método como predeterminado', async () => {
    await mount(<PaymentMethodsPage />);

    await click('Marcar Transferencia como predeterminado');

    expect(entities.togglePaymentMethod).toHaveBeenCalledWith(
      'tenant',
      'transfer',
      { isDefault: true },
    );
  });

  it('no deja apagar el predeterminado', async () => {
    await mount(<PaymentMethodsPage />);

    const toggle = document.querySelector<HTMLButtonElement>(
      '[aria-label="Desactivar Efectivo"]',
    )!;
    expect(toggle.disabled).toBe(true);
  });

  it('elimina un método propio y avisa si falla', async () => {
    entities.deletePaymentMethod.mockRejectedValue(
      new ApiError(500, 'boom', null),
    );
    await mount(<PaymentMethodsPage />);

    await click('Eliminar Transferencia');
    await click('Eliminar');

    expect(entities.deletePaymentMethod).toHaveBeenCalledWith(
      'tenant',
      'transfer',
    );
    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('bloquea el QR si Mercado Pago no está vinculado', async () => {
    await mount(<PaymentMethodsPage />);

    expect(
      document.querySelector('[title*="Mercado Pago no está vinculado"]'),
    ).toBeTruthy();
  });

  it('avisa si no se pudieron cargar los métodos', async () => {
    entities.listPaymentMethods.mockRejectedValue(new Error('offline'));
    await mount(<PaymentMethodsPage />);

    expect(pageText()).toContain('No pudimos cargar los métodos de pago');
  });
});
