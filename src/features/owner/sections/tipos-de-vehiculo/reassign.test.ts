import { describe, expect, it } from 'vitest';
import type { VehicleType } from '../../services/vehicle-types';
import {
  countVehiclesByType,
  describeUsage,
  reassignTargets,
  validateReassignTarget,
} from './reassign';

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

const AUTO = makeType({ id: 't-1', name: 'Auto' });
const SUV = makeType({ id: 't-2', name: 'SUV' });
const OTRO = makeType({ id: 't-3', name: 'Otro' });

describe('reassignTargets', () => {
  it('excluye el tipo que se está borrando', () => {
    const targets = reassignTargets([AUTO, SUV, OTRO], 't-1');
    expect(targets.map((t) => t.id)).toEqual(['t-3', 't-2']);
  });

  it('ordena por nombre', () => {
    const targets = reassignTargets([SUV, OTRO, AUTO], 't-9');
    expect(targets.map((t) => t.name)).toEqual(['Auto', 'Otro', 'SUV']);
  });

  it('borrar el único tipo deja la lista vacía: el modal tiene que ofrecer crear uno', () => {
    expect(reassignTargets([AUTO], 't-1')).toEqual([]);
  });
});

describe('validateReassignTarget', () => {
  const types = [AUTO, SUV, OTRO];

  it('sin elegir nada, pide elegir', () => {
    expect(validateReassignTarget(null, types)).toBe(
      'Elegí a qué tipo mover los vehículos.',
    );
  });

  it('acepta un tipo existente', () => {
    expect(
      validateReassignTarget({ kind: 'existing', id: 't-2' }, types),
    ).toBeNull();
  });

  it('rechaza un tipo que ya no está en la lista', () => {
    expect(
      validateReassignTarget({ kind: 'existing', id: 'fantasma' }, types),
    ).toContain('ya no existe');
  });

  it('acepta un nombre nuevo', () => {
    expect(
      validateReassignTarget({ kind: 'new', name: 'Utilitario' }, types),
    ).toBeNull();
  });

  it('exige el nombre cuando se crea uno nuevo', () => {
    expect(validateReassignTarget({ kind: 'new', name: '   ' }, types)).toBe(
      'El nombre es obligatorio.',
    );
  });

  it('rechaza más de 60 caracteres', () => {
    expect(
      validateReassignTarget({ kind: 'new', name: 'x'.repeat(61) }, types),
    ).toBe('Máximo 60 caracteres.');
  });

  it('rechaza un nombre repetido sin importar mayúsculas ni espacios', () => {
    expect(validateReassignTarget({ kind: 'new', name: '  sUv ' }, types)).toBe(
      'Ya tenés un tipo con ese nombre.',
    );
  });
});

describe('describeUsage', () => {
  it('usa el singular con uno solo', () => {
    expect(describeUsage(1)).toBe('1 vehículo usa este tipo.');
  });

  it('usa el plural con varios', () => {
    expect(describeUsage(7)).toBe('7 vehículos usan este tipo.');
  });
});

describe('countVehiclesByType', () => {
  it('agrupa por typeId', () => {
    const counts = countVehiclesByType([
      { typeId: 't-1' },
      { typeId: 't-1' },
      { typeId: 't-2' },
    ]);
    expect(counts.get('t-1')).toBe(2);
    expect(counts.get('t-2')).toBe(1);
  });

  it('un tipo sin vehículos no aparece: el llamador tiene que defaultear a 0', () => {
    expect(countVehiclesByType([]).get('t-1')).toBeUndefined();
  });
});
