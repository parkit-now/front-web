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
import type { VehicleType } from '../../services/vehicle-types';
import { TiposVehiculoPage } from './TiposVehiculoPage';

const types = vi.hoisted(() => ({
  listVehicleTypes: vi.fn(),
  createVehicleType: vi.fn(),
  updateVehicleType: vi.fn(),
  deleteVehicleType: vi.fn(),
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
vi.mock('../../services/vehicle-types', () => types);
vi.mock('../../services/vehicle-categories', () => ({
  listVehicleCategories: () =>
    Promise.resolve([
      { code: 'car', label: 'Auto', reservable: true, sortOrder: 1 },
      { code: 'motorcycle', label: 'Moto', reservable: true, sortOrder: 2 },
    ]),
}));

const NOW = '2026-10-07T15:00:00.000Z';

function type(overrides: Partial<VehicleType> = {}): VehicleType {
  return {
    id: 'auto',
    name: 'Auto',
    category: 'car',
    categoryInferred: false,
    accepted: true,
    vehicleCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    tenantId: 'tenant',
    version: 2,
    syncSeq: 1,
    ...overrides,
  };
}

function conflict(code: string) {
  return new ApiError(409, 'Conflict', { code } as never);
}

describe('TiposVehiculoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sucursal.role = 'owner';
    types.listVehicleTypes.mockResolvedValue([
      type(),
      type({
        id: 'moto',
        name: 'Moto',
        category: 'motorcycle',
        vehicleCount: 3,
        categoryInferred: true,
      }),
      type({ id: 'scooter', name: 'Scooter', category: 'motorcycle' }),
    ]);
    types.createVehicleType.mockImplementation(
      (_tenant: string, body: { id: string; name: string }) =>
        Promise.resolve(type({ id: body.id, name: body.name })),
    );
    types.updateVehicleType.mockResolvedValue(type());
    types.deleteVehicleType.mockResolvedValue({ reassignedVehicles: 0 });
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista los tipos con su categoría y uso', async () => {
    await mount(<TiposVehiculoPage />);

    expect(pageText()).toContain('Tipos de vehículo');
    expect(pageText()).toContain('Scooter');
    expect(types.listVehicleTypes).toHaveBeenCalledWith('tenant');
  });

  it('crea un tipo nuevo', async () => {
    await mount(<TiposVehiculoPage />);

    await click('Nuevo tipo');
    await change(field('Nombre'), 'Utilitario');
    await change(
      document.querySelector<HTMLSelectElement>('#vehicle-type-category')!,
      'car',
    );
    await click('Crear tipo');

    expect(types.createVehicleType).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ name: 'Utilitario', category: 'car' }),
    );
    expect(pageText()).toContain('Tipo de vehículo creado.');
  });

  it('muestra el nombre duplicado debajo del campo', async () => {
    types.createVehicleType.mockRejectedValue(
      conflict('VEHICLE_TYPE_DUPLICATE'),
    );
    await mount(<TiposVehiculoPage />);

    await click('Nuevo tipo');
    await change(field('Nombre'), 'Camioneta');
    await change(
      document.querySelector<HTMLSelectElement>('#vehicle-type-category')!,
      'car',
    );
    await click('Crear tipo');

    expect(pageText()).toContain('Ya tenés un tipo con ese nombre.');
  });

  it('edita un tipo', async () => {
    await mount(<TiposVehiculoPage />);

    await click('Editar Auto');
    await change(field('Nombre'), 'Automóvil');
    await click('Guardar cambios');

    expect(types.updateVehicleType).toHaveBeenCalledWith(
      'tenant',
      'auto',
      2,
      expect.objectContaining({ name: 'Automóvil' }),
    );
    expect(pageText()).toContain('Tipo actualizado.');
  });

  it('cambia si se acepta en caja', async () => {
    await mount(<TiposVehiculoPage />);

    await click(
      document.querySelector<HTMLElement>('[aria-label="Aceptar Auto"]')!,
    );

    expect(types.updateVehicleType).toHaveBeenCalledWith('tenant', 'auto', 2, {
      accepted: false,
    });
  });

  it('elimina un tipo sin uso después de confirmar', async () => {
    await mount(<TiposVehiculoPage />);

    await click('Eliminar Auto');
    expect(pageText()).toContain('No hay vehículos usándolo.');
    await click('Eliminar');

    expect(types.deleteVehicleType).toHaveBeenCalledWith(
      'tenant',
      'auto',
      2,
      undefined,
    );
    expect(pageText()).toContain('Tipo eliminado.');
  });

  it('pide reasignar los vehículos al eliminar un tipo en uso', async () => {
    types.deleteVehicleType.mockResolvedValue({ reassignedVehicles: 3 });
    await mount(<TiposVehiculoPage />);

    await click('Eliminar Moto');
    await change(
      document.querySelector<HTMLSelectElement>('#reassign-target')!,
      'scooter',
    );
    await click('Eliminar y reasignar');

    expect(types.deleteVehicleType).toHaveBeenCalledWith(
      'tenant',
      'moto',
      2,
      'scooter',
    );
    expect(pageText()).toContain('Movimos 3 vehículo(s).');
  });

  it('ante un conflicto de versión cierra, recarga y avisa', async () => {
    types.deleteVehicleType.mockRejectedValue(conflict('CONFLICT'));
    await mount(<TiposVehiculoPage />);

    await click('Eliminar Auto');
    await click('Eliminar');

    expect(document.querySelector('.toast-error')).toBeTruthy();
    expect(types.listVehicleTypes.mock.calls.length).toBeGreaterThan(1);
  });

  it('sin permisos de dueño queda en solo lectura', async () => {
    sucursal.role = 'operator';
    await mount(<TiposVehiculoPage />);

    expect(pageText()).toContain('Solo lectura');
    expect(pageText()).not.toContain('Nuevo tipo');
  });
});
