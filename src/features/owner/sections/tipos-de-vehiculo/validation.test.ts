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
    category: 'car',
    categoryInferred: false,
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
  it('arranca vacío, sin categoría y aceptado', () => {
    expect(emptyVehicleTypeForm()).toEqual({
      name: '',
      category: '',
      accepted: true,
    });
  });
});

describe('vehicleTypeToForm', () => {
  it('precarga nombre, categoría y aceptado', () => {
    expect(
      vehicleTypeToForm(makeType({ accepted: false, category: 'suv' })),
    ).toEqual({ name: 'Auto', category: 'suv', accepted: false });
  });
});

describe('canSubmitVehicleTypeForm', () => {
  const ok = { name: 'Utilitario', category: 'van', accepted: true } as const;

  it('acepta un nombre y una categoría válidos', () => {
    expect(canSubmitVehicleTypeForm(ok)).toBe(true);
  });

  it('exige categoría', () => {
    expect(canSubmitVehicleTypeForm({ ...ok, category: '' })).toBe(false);
  });

  it('mide sobre el trim', () => {
    expect(canSubmitVehicleTypeForm({ ...ok, name: '   ' })).toBe(false);
  });

  it('rechaza más de 60 caracteres', () => {
    expect(canSubmitVehicleTypeForm({ ...ok, name: 'x'.repeat(61) })).toBe(
      false,
    );
  });
});

describe('validateVehicleTypeForm', () => {
  const form = { name: 'Auto', category: 'car', accepted: true } as const;

  it('colapsa los espacios internos, igual que el backend', () => {
    const { payload } = validateVehicleTypeForm(
      { ...form, name: '  Micro    escolar  ' },
      noClash,
    );
    expect(payload?.name).toBe('Micro escolar');
  });

  it('sin categoría marca el error y no arma el payload', () => {
    const { errors, payload } = validateVehicleTypeForm(
      { ...form, category: '' },
      noClash,
    );
    expect(errors.category).toBe('Elegí una categoría.');
    expect(payload).toBeUndefined();
  });

  it('detecta un duplicado sin importar mayúsculas', () => {
    const { errors } = validateVehicleTypeForm(
      { ...form, name: 'auto' },
      { types: [makeType()], editingId: null },
    );
    expect(errors.name).toBe('Ya tenés un tipo con ese nombre.');
  });

  it('editando, no choca consigo mismo', () => {
    const { errors, payload } = validateVehicleTypeForm(
      { ...form, accepted: false },
      { types: [makeType()], editingId: 't-1' },
    );
    expect(errors).toEqual({});
    expect(payload).toEqual({
      name: 'Auto',
      category: 'car',
      accepted: false,
    });
  });
});

describe('diffVehicleTypeUpdate', () => {
  const current = makeType();
  const same = { name: 'Auto', category: 'car', accepted: true } as const;

  it('sin cambios devuelve un objeto vacío', () => {
    expect(diffVehicleTypeUpdate(same, current)).toEqual({});
  });

  it('manda solo el nombre cuando solo cambió el nombre', () => {
    expect(
      diffVehicleTypeUpdate({ ...same, name: 'Automóvil' }, current),
    ).toEqual({ name: 'Automóvil' });
  });

  it('manda solo accepted cuando solo cambió el toggle', () => {
    expect(
      diffVehicleTypeUpdate({ ...same, accepted: false }, current),
    ).toEqual({ accepted: false });
  });

  it('manda la categoría cuando cambió', () => {
    expect(
      diffVehicleTypeUpdate({ ...same, category: 'suv' }, current),
    ).toEqual({ category: 'suv' });
  });

  it('si la categoría era inferida la manda aunque no cambie (para confirmarla)', () => {
    expect(
      diffVehicleTypeUpdate(same, makeType({ categoryInferred: true })),
    ).toEqual({ category: 'car' });
  });
});
