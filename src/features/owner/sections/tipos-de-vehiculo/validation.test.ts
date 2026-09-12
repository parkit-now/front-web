import { describe, expect, it } from 'vitest';
import type { VehicleType } from '../../services/vehicle-types';
import {
  canSubmitVehicleTypeForm,
  diffVehicleTypeUpdate,
  emptyVehicleTypeForm,
  validateVehicleTypeForm,
  vehicleTypeToForm,
} from './validation';

function makeType(overrides: Partial<VehicleType> = {}): VehicleType {
  return {
    id: 't-1',
    tenantId: 'tenant-1',
    name: 'Auto',
    accepted: true,
    vehicleCount: 0,
    version: 1,
    syncSeq: 1,
    deletedAt: null,
    createdAt: '2026-08-28T22:00:00.000Z',
    updatedAt: '2026-08-28T22:00:00.000Z',
    ...overrides,
  };
}

const noClash = { types: [], editingId: null };

describe('emptyVehicleTypeForm', () => {
  it('arranca vacío y aceptado', () => {
    expect(emptyVehicleTypeForm()).toEqual({ name: '', accepted: true });
  });
});

describe('vehicleTypeToForm', () => {
  it('precarga nombre y aceptado', () => {
    expect(vehicleTypeToForm(makeType({ accepted: false }))).toEqual({
      name: 'Auto',
      accepted: false,
    });
  });
});

describe('canSubmitVehicleTypeForm', () => {
  it('acepta un nombre válido', () => {
    expect(
      canSubmitVehicleTypeForm({ name: 'Utilitario', accepted: true }),
    ).toBe(true);
  });

  it('mide sobre el trim', () => {
    expect(canSubmitVehicleTypeForm({ name: '   ', accepted: true })).toBe(
      false,
    );
  });

  it('rechaza más de 60 caracteres', () => {
    expect(
      canSubmitVehicleTypeForm({ name: 'x'.repeat(61), accepted: true }),
    ).toBe(false);
  });
});

describe('validateVehicleTypeForm', () => {
  it('colapsa los espacios internos, igual que el backend', () => {
    const { payload } = validateVehicleTypeForm(
      { name: '  Micro    escolar  ', accepted: true },
      noClash,
    );
    expect(payload?.name).toBe('Micro escolar');
  });

  it('detecta un duplicado sin importar mayúsculas', () => {
    const { errors } = validateVehicleTypeForm(
      { name: 'auto', accepted: true },
      { types: [makeType()], editingId: null },
    );
    expect(errors.name).toBe('Ya tenés un tipo con ese nombre.');
  });

  it('editando, no choca consigo mismo', () => {
    const { errors, payload } = validateVehicleTypeForm(
      { name: 'Auto', accepted: false },
      { types: [makeType()], editingId: 't-1' },
    );
    expect(errors).toEqual({});
    expect(payload).toEqual({ name: 'Auto', accepted: false });
  });
});

describe('diffVehicleTypeUpdate', () => {
  const current = makeType();

  it('sin cambios devuelve un objeto vacío', () => {
    expect(
      diffVehicleTypeUpdate({ name: 'Auto', accepted: true }, current),
    ).toEqual({});
  });

  it('manda solo el nombre cuando solo cambió el nombre', () => {
    expect(
      diffVehicleTypeUpdate({ name: 'Automóvil', accepted: true }, current),
    ).toEqual({ name: 'Automóvil' });
  });

  it('manda solo accepted cuando solo cambió el toggle', () => {
    expect(
      diffVehicleTypeUpdate({ name: 'Auto', accepted: false }, current),
    ).toEqual({ accepted: false });
  });
});
