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
import type { Rate } from '../../services/rates';
import { TarifasPage } from './TarifasPage';

const rates = vi.hoisted(() => ({
  listRates: vi.fn(),
  listOpenEntriesByRate: vi.fn(),
  createRate: vi.fn(),
  updateRate: vi.fn(),
  deleteRate: vi.fn(),
}));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user',
}));
vi.mock('../../services/rates', () => rates);

const NOW = '2026-10-07T15:00:00.000Z';

function rate(overrides: Partial<Rate> = {}): Rate {
  return {
    id: 'rate-auto',
    name: 'DIA AUTO',
    shortcutNumber: 1,
    hourPriceArs: 1500,
    fractionPriceArs: 125,
    mediaEstadiaPriceArs: 9000,
    stayPriceArs: 15000,
    autoFractionPrice: true,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    tenantId: 'tenant',
    version: 3,
    syncSeq: 1,
    ...overrides,
  };
}

describe('TarifasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sucursal.role = 'owner';
    rates.listRates.mockResolvedValue([
      rate(),
      rate({
        id: 'rate-moto',
        name: 'MOTO',
        shortcutNumber: 2,
        isActive: false,
      }),
    ]);
    rates.listOpenEntriesByRate.mockResolvedValue({ counts: [] });
    rates.createRate.mockResolvedValue(rate({ id: 'nueva' }));
    rates.updateRate.mockResolvedValue(rate());
    rates.deleteRate.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista las tarifas activas e inactivas', async () => {
    await mount(<TarifasPage />);

    expect(pageText()).toContain('DIA AUTO');
    expect(pageText()).toContain('MOTO');
    expect(pageText()).toContain('Inactiva');
    expect(rates.listRates).toHaveBeenCalledWith('tenant', true);
  });

  it('crea una tarifa nueva', async () => {
    await mount(<TarifasPage />);

    await click('Nueva tarifa');
    await change(field('Nº atajo'), '3');
    await change(field('Nombre'), 'NOCHE');
    await change(field('Precio hora'), '2000');
    await change(field('Precio media estadía (12 h)'), '10000');
    await change(field('Precio estadía (24 h)'), '18000');
    await click('Crear tarifa');

    expect(rates.createRate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ name: 'NOCHE', shortcutNumber: 3 }),
    );
    expect(pageText()).toContain('Tarifa creada.');
  });

  it('no deja crear una tarifa sin nombre', async () => {
    await mount(<TarifasPage />);

    await click('Nueva tarifa');
    await click('Crear tarifa');

    expect(rates.createRate).not.toHaveBeenCalled();
  });

  it('edita una tarifa sin autos adentro', async () => {
    await mount(<TarifasPage />);

    await click('Editar DIA AUTO');
    await change(field('Nombre'), 'DIA AUTO PLUS');
    await click('Guardar cambios');

    expect(rates.updateRate).toHaveBeenCalledWith(
      'tenant',
      'rate-auto',
      3,
      expect.objectContaining({ name: 'DIA AUTO PLUS' }),
    );
    expect(pageText()).toContain('Tarifa actualizada.');
  });

  it('avisa si no hay cambios para guardar', async () => {
    await mount(<TarifasPage />);

    await click('Editar DIA AUTO');
    await click('Guardar cambios');

    expect(rates.updateRate).not.toHaveBeenCalled();
    expect(pageText()).toContain('No hay cambios para guardar.');
  });

  it('pregunta qué hacer con los autos adentro al cambiar el precio', async () => {
    rates.listOpenEntriesByRate.mockResolvedValue({
      counts: [{ rateId: 'rate-auto', openEntries: 2 }],
    });
    await mount(<TarifasPage />);

    await click('Editar DIA AUTO');
    await change(field('Precio hora'), '1800');
    await click('Guardar cambios');

    expect(pageText()).toContain('Cambiaste los precios de «DIA AUTO»');
    await click('Pasar los 2 al precio nuevo');
    expect(rates.updateRate).toHaveBeenCalledWith(
      'tenant',
      'rate-auto',
      3,
      expect.objectContaining({ applyToOpenEntries: true }),
    );
  });

  it('desactiva, reactiva y elimina con confirmación', async () => {
    await mount(<TarifasPage />);

    await click('Desactivar DIA AUTO');
    await click('Desactivar');
    expect(rates.updateRate).toHaveBeenCalledWith('tenant', 'rate-auto', 3, {
      isActive: false,
    });

    await click('Reactivar MOTO');
    await click('Reactivar');
    expect(rates.updateRate).toHaveBeenCalledWith('tenant', 'rate-moto', 3, {
      isActive: true,
    });

    await click('Eliminar MOTO');
    await click('Eliminar');
    expect(rates.deleteRate).toHaveBeenCalledWith('tenant', 'rate-moto', 3);
    expect(pageText()).toContain('Tarifa eliminada.');
  });

  it('ante un conflicto de versión recarga y avisa', async () => {
    rates.deleteRate.mockRejectedValue(new ApiError(409, 'Conflict', null));
    await mount(<TarifasPage />);

    await click('Eliminar MOTO');
    await click('Eliminar');

    expect(pageText()).toContain('La tarifa fue modificada por otra persona');
    expect(rates.listRates.mock.calls.length).toBeGreaterThan(1);
  });

  it('muestra el error traducido si falla el guardado', async () => {
    rates.updateRate.mockRejectedValue(new ApiError(500, 'boom', null));
    await mount(<TarifasPage />);

    await click('Desactivar DIA AUTO');
    await click('Desactivar');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('sin permisos de dueño no muestra acciones', async () => {
    sucursal.role = 'operator';
    await mount(<TarifasPage />);

    expect(pageText()).not.toContain('Nueva tarifa');
    expect(document.querySelector('[aria-label="Editar DIA AUTO"]')).toBeNull();
  });
});
