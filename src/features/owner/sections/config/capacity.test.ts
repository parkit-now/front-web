import { describe, expect, it } from 'vitest';
import { parseCapacityTotal } from './capacity';

describe('parseCapacityTotal', () => {
  it('acepta un entero', () => {
    expect(parseCapacityTotal('110')).toEqual({ total: 110 });
  });

  it('acepta cero', () => {
    expect(parseCapacityTotal('0')).toEqual({ total: 0 });
  });

  it('ignora los espacios sobrantes', () => {
    expect(parseCapacityTotal('  55  ')).toEqual({ total: 55 });
  });

  it('rechaza el vacío', () => {
    expect(parseCapacityTotal('   ')).toEqual({
      error: 'Ingresá la cantidad de plazas.',
    });
  });

  it('rechaza lo que no es número', () => {
    expect(parseCapacityTotal('abc')).toEqual({
      error: 'Tiene que ser un número entero.',
    });
  });

  it('rechaza los decimales', () => {
    expect(parseCapacityTotal('12.5')).toEqual({
      error: 'Tiene que ser un número entero.',
    });
  });

  it('rechaza los negativos', () => {
    expect(parseCapacityTotal('-1')).toEqual({
      error: 'No puede ser negativo.',
    });
  });
});
