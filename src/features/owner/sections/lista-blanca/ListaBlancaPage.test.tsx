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
import type { LprIgnoredPlate } from '../../services/lpr-ignored-plates';
import { ListaBlancaPage } from './ListaBlancaPage';

const plates = vi.hoisted(() => ({
  listLprIgnoredPlates: vi.fn(),
  createLprIgnoredPlate: vi.fn(),
  updateLprIgnoredPlate: vi.fn(),
  deleteLprIgnoredPlate: vi.fn(),
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
vi.mock('../../services/lpr-ignored-plates', () => plates);

const NOW = '2026-10-07T15:00:00.000Z';

function plate(overrides: Partial<LprIgnoredPlate> = {}): LprIgnoredPlate {
  return {
    id: 'ambulancia',
    plate: 'AB123CD',
    notes: 'Ambulancia del barrio',
    active: true,
    validFrom: null,
    validUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    tenantId: 'tenant',
    version: 1,
    syncSeq: 1,
    ...overrides,
  };
}

describe('ListaBlancaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sucursal.role = 'owner';
    plates.listLprIgnoredPlates.mockResolvedValue([
      plate(),
      plate({
        id: 'vencida',
        plate: 'XYZ999',
        notes: null,
        active: false,
        validFrom: '2026-01-01',
        validUntil: '2026-02-01',
      }),
    ]);
    plates.createLprIgnoredPlate.mockResolvedValue(plate({ id: 'nueva' }));
    plates.updateLprIgnoredPlate.mockResolvedValue(plate());
    plates.deleteLprIgnoredPlate.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('sólo el dueño ve la lista blanca', async () => {
    sucursal.role = 'operator';
    await mount(<ListaBlancaPage />);

    expect(pageText()).toBe('');
  });

  it('lista las patentes con su vigencia', async () => {
    await mount(<ListaBlancaPage />);

    expect(pageText()).toContain('Ambulancia del barrio');
    expect(pageText()).toContain('Inactiva');
    expect(pageText()).toContain('01/01/2026');
    expect(pageText()).toContain('Sin límite');
  });

  it('agrega una patente con vigencia', async () => {
    await mount(<ListaBlancaPage />);

    await click('Agregar patente');
    await change(field('Patente'), 'ac 456 de');
    await change(field<HTMLTextAreaElement>('Nota (opcional)'), 'Proveedor');
    await change(field('Desde (opcional)'), '2026-10-01');
    await change(field('Hasta (opcional)'), '2026-12-31');
    await click('Guardar');

    expect(plates.createLprIgnoredPlate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({
        plate: 'AC456DE',
        notes: 'Proveedor',
        validFrom: '2026-10-01',
        validUntil: '2026-12-31',
        active: true,
      }),
    );
  });

  it('rechaza una patente repetida o fechas al revés', async () => {
    await mount(<ListaBlancaPage />);

    await click('Agregar patente');
    await change(field('Patente'), 'AB123CD');
    await click('Guardar');
    expect(pageText()).toContain('Esta patente ya está en la lista blanca.');

    await change(field('Patente'), 'AC456DE');
    await change(field('Desde (opcional)'), '2026-12-31');
    await change(field('Hasta (opcional)'), '2026-01-01');
    await click('Guardar');
    expect(pageText()).toContain('La fecha hasta debe ser igual o posterior');
    expect(plates.createLprIgnoredPlate).not.toHaveBeenCalled();
  });

  it('edita una patente', async () => {
    await mount(<ListaBlancaPage />);

    await click('Editar AB123CD');
    await change(field<HTMLTextAreaElement>('Nota (opcional)'), 'Ambulancia');
    await click('Guardar');

    expect(plates.updateLprIgnoredPlate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ id: 'ambulancia' }),
      expect.objectContaining({ notes: 'Ambulancia' }),
    );
  });

  it('desactiva, reactiva y elimina con confirmación', async () => {
    await mount(<ListaBlancaPage />);

    await click('Desactivar AB123CD');
    await click('Desactivar');
    expect(plates.updateLprIgnoredPlate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ id: 'ambulancia' }),
      { active: false },
    );

    await click('Reactivar XYZ999');
    await click('Reactivar');
    expect(plates.updateLprIgnoredPlate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ id: 'vencida' }),
      { active: true },
    );

    await click('Eliminar XYZ999');
    await click('Eliminar');
    expect(plates.deleteLprIgnoredPlate).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ id: 'vencida' }),
    );
  });

  it('muestra el error del backend', async () => {
    plates.deleteLprIgnoredPlate.mockRejectedValue(
      new ApiError(500, 'boom', null),
    );
    await mount(<ListaBlancaPage />);

    await click('Eliminar AB123CD');
    await click('Eliminar');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('avisa si no se pudo cargar', async () => {
    plates.listLprIgnoredPlates.mockRejectedValue(new Error('offline'));
    await mount(<ListaBlancaPage />);

    expect(pageText()).toContain('No pudimos cargar la lista blanca.');
  });
});
