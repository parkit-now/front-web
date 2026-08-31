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

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    brand: 'Toyota',
    model: 'Corolla',
    type: 'auto',
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
  return { brand: 'Fiat', model: 'Cronos', type: '', ...overrides };
}

const noClash = { vehicles: [], editingId: null };

describe('emptyVehicleForm', () => {
  it('arranca con todo vacío', () => {
    expect(emptyVehicleForm()).toEqual({ brand: '', model: '', type: '' });
  });
});

describe('vehicleToForm', () => {
  it('precarga los tres campos', () => {
    expect(vehicleToForm(makeVehicle())).toEqual({
      brand: 'Toyota',
      model: 'Corolla',
      type: 'auto',
    });
  });

  it('mapea un tipo nulo a la opción vacía', () => {
    expect(vehicleToForm(makeVehicle({ type: null })).type).toBe('');
  });
});

describe('canSubmitVehicleForm', () => {
  it('acepta un formulario completo', () => {
    expect(canSubmitVehicleForm(form())).toBe(true);
  });

  it('el tipo es opcional', () => {
    expect(canSubmitVehicleForm(form({ type: '' }))).toBe(true);
  });

  it.each([
    ['marca vacía', form({ brand: '' })],
    ['modelo vacío', form({ model: '' })],
    // El caso clásico: si midiera `.length` en vez de `.trim().length`, tres
    // espacios habilitarían el botón y el error saltaría recién al guardar.
    ['marca con solo espacios', form({ brand: '   ' })],
    ['modelo con solo espacios', form({ model: '  ' })],
  ])('rechaza %s', (_label, state) => {
    expect(canSubmitVehicleForm(state)).toBe(false);
  });

  it('acepta 120 caracteres exactos y rechaza 121', () => {
    expect(canSubmitVehicleForm(form({ brand: 'a'.repeat(120) }))).toBe(true);
    expect(canSubmitVehicleForm(form({ brand: 'a'.repeat(121) }))).toBe(false);
  });
});

describe('validateVehicleForm', () => {
  it('devuelve el payload con los valores recortados', () => {
    const { errors, payload } = validateVehicleForm(
      form({ brand: '  Fiat  ', model: ' Cronos ', type: 'auto' }),
      noClash,
    );

    expect(errors).toEqual({});
    expect(payload).toEqual({ brand: 'Fiat', model: 'Cronos', type: 'auto' });
  });

  it('convierte el tipo vacío en undefined, no en cadena vacía', () => {
    // Mandar `type: ''` reventaría el @IsEnum del backend con un 400.
    const { payload } = validateVehicleForm(form({ type: '' }), noClash);
    expect(payload?.type).toBeUndefined();
  });

  it('marca la marca y el modelo obligatorios', () => {
    const { errors, payload } = validateVehicleForm(
      form({ brand: '  ', model: '' }),
      noClash,
    );

    expect(errors.brand).toBe('La marca es obligatoria.');
    expect(errors.model).toBe('El modelo es obligatorio.');
    expect(payload).toBeUndefined();
  });

  it('corta en 120 caracteres', () => {
    const { errors } = validateVehicleForm(
      form({ brand: 'a'.repeat(121) }),
      noClash,
    );
    expect(errors.brand).toBe('Máximo 120 caracteres.');
  });

  it('rechaza un duplicado propio', () => {
    const { errors, payload } = validateVehicleForm(form(), {
      vehicles: [makeVehicle({ id: 'v-9', brand: 'Fiat', model: 'Cronos' })],
      editingId: null,
    });

    expect(errors.model).toBe('Ya tenés un vehículo con esa marca y modelo.');
    expect(payload).toBeUndefined();
  });

  it('rechaza un duplicado aunque cambie la capitalización o los espacios', () => {
    const { errors } = validateVehicleForm(
      form({ brand: '  fIaT ', model: 'CRONOS' }),
      {
        vehicles: [makeVehicle({ id: 'v-9', brand: 'Fiat', model: 'Cronos' })],
        editingId: null,
      },
    );

    expect(errors.model).toBe('Ya tenés un vehículo con esa marca y modelo.');
  });

  it('avisa distinto cuando el choque es contra el catálogo global', () => {
    const { errors } = validateVehicleForm(
      form({ brand: 'Toyota', model: 'Corolla' }),
      {
        vehicles: [makeVehicle({ id: 'g-1', tenantId: null })],
        editingId: null,
      },
    );

    expect(errors.model).toBe(
      '"Toyota Corolla" ya está en el catálogo global, no hace falta cargarlo.',
    );
  });

  it('no se choca consigo mismo al editar', () => {
    const { errors, payload } = validateVehicleForm(
      form({ brand: 'Toyota', model: 'Corolla' }),
      { vehicles: [makeVehicle()], editingId: 'v-1' },
    );

    expect(errors).toEqual({});
    expect(payload).toBeDefined();
  });
});

describe('diffVehicleUpdate', () => {
  it('devuelve {} cuando no cambió nada, para no gastar un PATCH', () => {
    const current = makeVehicle();
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla', type: 'auto' },
      current,
    );
    expect(body).toEqual({});
  });

  it('manda solo los campos que cambiaron', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla Cross', type: 'auto' },
      makeVehicle(),
    );
    expect(body).toEqual({ model: 'Corolla Cross' });
  });

  it('detecta el alta de un tipo donde no había', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla', type: 'suv' },
      makeVehicle({ type: null }),
    );
    expect(body).toEqual({ type: 'suv' });
  });

  it('sacar el tipo se manda como "otro", porque el DTO no acepta null', () => {
    const body = diffVehicleUpdate(
      { brand: 'Toyota', model: 'Corolla', type: undefined },
      makeVehicle({ type: 'auto' }),
    );
    expect(body).toEqual({ type: 'otro' });
  });
});
