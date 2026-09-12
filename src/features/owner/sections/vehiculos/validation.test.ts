import { describe, expect, it } from 'vitest';
import type { Vehicle } from '../../services/vehicles';
import {
  canSubmitVehicleForm,
  diffVehicleUpdate,
  emptyVehicleForm,
  validateVehicleForm,
  vehicleToForm,
  type VehicleFormState,
} from './validation';

const TYPE_AUTO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TYPE_SUV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    brand: 'Toyota',
    model: 'Corolla',
    typeId: TYPE_AUTO,
    tenantId: 'tenant-1',
    version: 1,
    syncSeq: 1,
    deletedAt: null,
    createdAt: '2026-08-28T22:00:00.000Z',
    updatedAt: '2026-08-28T22:00:00.000Z',
    ...overrides,
  };
}

function form(overrides: Partial<VehicleFormState> = {}): VehicleFormState {
  return { brand: 'Fiat', model: 'Cronos', typeId: TYPE_AUTO, ...overrides };
}

const noClash = { vehicles: [], editingId: null };

describe('emptyVehicleForm', () => {
  it('arranca con todo vacío', () => {
    expect(emptyVehicleForm()).toEqual({ brand: '', model: '', typeId: '' });
  });
});

describe('vehicleToForm', () => {
  it('precarga los tres campos', () => {
    expect(vehicleToForm(makeVehicle())).toEqual({
      brand: 'Toyota',
      model: 'Corolla',
      typeId: TYPE_AUTO,
    });
  });
});

describe('canSubmitVehicleForm', () => {
  it('acepta un formulario completo', () => {
    expect(canSubmitVehicleForm(form())).toBe(true);
  });

  it('el tipo es OBLIGATORIO: borrar un tipo obliga a reasignar, así que un vehículo nunca queda sin tipo', () => {
    expect(canSubmitVehicleForm(form({ typeId: '' }))).toBe(false);
  });

  it('rechaza marca o modelo en blanco', () => {
    expect(canSubmitVehicleForm(form({ brand: '   ' }))).toBe(false);
    expect(canSubmitVehicleForm(form({ model: '' }))).toBe(false);
  });

  it('mide sobre el trim: tres espacios no habilitan el botón', () => {
    expect(canSubmitVehicleForm(form({ brand: '   ', model: '   ' }))).toBe(
      false,
    );
  });

  it('rechaza más de 120 caracteres', () => {
    expect(canSubmitVehicleForm(form({ brand: 'x'.repeat(121) }))).toBe(false);
  });
});

describe('validateVehicleForm', () => {
  it('devuelve el payload cuando está todo bien', () => {
    const { errors, payload } = validateVehicleForm(form(), noClash);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      brand: 'Fiat',
      model: 'Cronos',
      typeId: TYPE_AUTO,
    });
  });

  it('recorta los espacios sobrantes', () => {
    const { payload } = validateVehicleForm(
      form({ brand: '  Fiat  ', model: '  Cronos  ' }),
      noClash,
    );
    expect(payload).toMatchObject({ brand: 'Fiat', model: 'Cronos' });
  });

  it('exige la marca y el modelo', () => {
    const { errors } = validateVehicleForm(
      form({ brand: '', model: '' }),
      noClash,
    );
    expect(errors.brand).toBeTruthy();
    expect(errors.model).toBeTruthy();
  });

  it('exige el tipo', () => {
    const { errors } = validateVehicleForm(form({ typeId: '' }), noClash);
    expect(errors.typeId).toBeTruthy();
  });

  it('detecta un duplicado sin importar mayúsculas ni espacios', () => {
    const { errors } = validateVehicleForm(
      form({ brand: '  toYOta ', model: 'COROLLA' }),
      { vehicles: [makeVehicle()], editingId: null },
    );
    expect(errors.model).toBe('Ya tenés un vehículo con esa marca y modelo.');
  });

  it('editando, no choca consigo mismo', () => {
    const { errors, payload } = validateVehicleForm(
      form({ brand: 'Toyota', model: 'Corolla' }),
      { vehicles: [makeVehicle()], editingId: 'v-1' },
    );
    expect(errors).toEqual({});
    expect(payload).toBeTruthy();
  });
});

describe('diffVehicleUpdate', () => {
  const current = makeVehicle();

  it('sin cambios devuelve un objeto vacío, para no gastar un PATCH', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla', typeId: TYPE_AUTO },
      current,
    );
    expect(body).toEqual({});
  });

  it('manda solo lo que cambió', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla GLI', typeId: TYPE_AUTO },
      current,
    );
    expect(body).toEqual({ model: 'Corolla GLI' });
  });

  it('detecta el cambio de tipo', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla', typeId: TYPE_SUV },
      current,
    );
    expect(body).toEqual({ typeId: TYPE_SUV });
  });

  it('si los tipos no cargaron NO toca typeId: mandarlo en blanco le borraría el tipo al vehículo', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla', typeId: '' },
      current,
      false,
    );
    expect(body).toEqual({});
  });
});
