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
import type { Vehicle } from '../../services/vehicles';
import { VehiculosPage } from './VehiculosPage';

const vehicles = vi.hoisted(() => ({
  listVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
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
vi.mock('../../services/vehicles', () => vehicles);
vi.mock('../../services/vehicle-types', () => ({
  listVehicleTypes: () =>
    Promise.resolve([
      { id: 'auto', name: 'Auto', category: 'car', accepted: true },
      { id: 'moto', name: 'Moto', category: 'motorcycle', accepted: true },
    ]),
}));

const NOW = '2026-10-07T15:00:00.000Z';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'bora',
    brand: 'Volkswagen',
    model: 'Bora',
    typeId: 'auto',
    createdAt: NOW,
    updatedAt: NOW,
    tenantId: 'tenant',
    version: 4,
    syncSeq: 1,
    ...overrides,
  };
}

describe('VehiculosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sucursal.role = 'owner';
    vehicles.listVehicles.mockResolvedValue([
      vehicle(),
      vehicle({ id: 'cg', brand: 'Honda', model: 'CG 150', typeId: 'moto' }),
    ]);
    vehicles.createVehicle.mockResolvedValue(vehicle({ id: 'nuevo' }));
    vehicles.updateVehicle.mockResolvedValue(vehicle());
    vehicles.deleteVehicle.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista el catálogo con el tipo de cada vehículo', async () => {
    await mount(<VehiculosPage />);

    expect(pageText()).toContain('Catálogo de vehículos');
    expect(pageText()).toContain('Bora');
    expect(pageText()).toContain('CG 150');
  });

  it('agrega un vehículo al catálogo', async () => {
    await mount(<VehiculosPage />);

    await click('Nuevo vehículo');
    await change(field('Marca (ej. Volkswagen)'), 'Fiat');
    await change(field('Modelo (ej. Bora)'), 'Cronos');
    await change(
      document.querySelector<HTMLSelectElement>('#vehicle-type')!,
      'auto',
    );
    await click('Crear vehículo');

    expect(vehicles.createVehicle).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({
        brand: 'Fiat',
        model: 'Cronos',
        typeId: 'auto',
      }),
    );
    expect(pageText()).toContain('Vehículo agregado al catálogo.');
  });

  it('edita un vehículo', async () => {
    await mount(<VehiculosPage />);

    await click('Editar Volkswagen Bora');
    await change(field('Modelo (ej. Bora)'), 'Vento');
    await click('Guardar cambios');

    expect(vehicles.updateVehicle).toHaveBeenCalledWith(
      'tenant',
      'bora',
      4,
      expect.objectContaining({ model: 'Vento' }),
    );
  });

  it('avisa si no hay cambios', async () => {
    await mount(<VehiculosPage />);

    await click('Editar Volkswagen Bora');
    await click('Guardar cambios');

    expect(vehicles.updateVehicle).not.toHaveBeenCalled();
    expect(pageText()).toContain('No hay cambios para guardar.');
  });

  it('elimina un vehículo después de confirmar', async () => {
    await mount(<VehiculosPage />);

    await click('Eliminar Honda CG 150');
    await click('Eliminar');

    expect(vehicles.deleteVehicle).toHaveBeenCalledWith('tenant', 'cg', 4);
    expect(pageText()).toContain('Vehículo eliminado.');
  });

  it('ante un conflicto recarga el catálogo', async () => {
    vehicles.deleteVehicle.mockRejectedValue(
      new ApiError(409, 'Conflict', null),
    );
    await mount(<VehiculosPage />);

    await click('Eliminar Honda CG 150');
    await click('Eliminar');

    expect(document.querySelector('.toast-error')).toBeTruthy();
    expect(vehicles.listVehicles.mock.calls.length).toBeGreaterThan(1);
  });

  it('sin permisos de dueño no muestra acciones', async () => {
    sucursal.role = 'operator';
    await mount(<VehiculosPage />);

    expect(pageText()).not.toContain('Nuevo vehículo');
  });
});
