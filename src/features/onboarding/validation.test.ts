import { describe, expect, it } from 'vitest';
import {
  parseTotalSpots,
  validateSucursalForm,
  validateTotalSpots,
} from './validation';

describe('parseTotalSpots', () => {
  it('vacío es undefined: el campo es opcional', () => {
    expect(parseTotalSpots('')).toBeUndefined();
    expect(parseTotalSpots('   ')).toBeUndefined();
  });

  it('parsea un entero', () => {
    expect(parseTotalSpots('110')).toBe(110);
  });

  it('trunca los decimales', () => {
    expect(parseTotalSpots('12.9')).toBe(12);
  });

  it('descarta los negativos', () => {
    expect(parseTotalSpots('-5')).toBeUndefined();
  });
});

describe('validateTotalSpots', () => {
  it('vacío es válido: el campo es opcional', () => {
    expect(validateTotalSpots('')).toBeNull();
  });

  it('acepta un entero', () => {
    expect(validateTotalSpots('110')).toBeNull();
  });

  it('avisa cuando el valor no es un número, en vez de descartarlo en silencio', () => {
    expect(validateTotalSpots('abc')).toBe(
      'Ingresá un número entero de plazas (o dejalo vacío)',
    );
  });

  it('rechaza decimales y negativos', () => {
    expect(validateTotalSpots('12.5')).toBeTruthy();
    expect(validateTotalSpots('-1')).toBeTruthy();
  });
});

describe('validateSucursalForm', () => {
  const base = { name: 'Playa', address: 'Av. 1', totalSpots: '' };

  it('acepta el formulario mínimo', () => {
    expect(validateSucursalForm(base)).toEqual({});
  });

  it('exige nombre y domicilio', () => {
    const errors = validateSucursalForm({ ...base, name: '', address: '  ' });
    expect(errors.name).toBeTruthy();
    expect(errors.address).toBeTruthy();
  });

  it('reporta el error de plazas junto con el resto', () => {
    const errors = validateSucursalForm({ ...base, totalSpots: 'abc' });
    expect(errors.totalSpots).toBeTruthy();
  });
});
