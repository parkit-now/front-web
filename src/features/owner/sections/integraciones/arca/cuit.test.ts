import { describe, expect, it } from 'vitest';
import { isValidArcaCuit, normalizeArcaCuit, validateArcaCuit } from './cuit';

// Mismos casos que `backend/src/arca/arca-cuit.spec.ts`: la regla es la misma,
// sólo cambia dónde se define.
describe('isValidArcaCuit', () => {
  it('acepta un CUIT con el dígito verificador correcto', () => {
    expect(isValidArcaCuit('20123456786')).toBe(true);
    expect(isValidArcaCuit('30500010912')).toBe(true);
  });

  it('acepta el mismo CUIT con guiones o espacios', () => {
    expect(isValidArcaCuit('20-12345678-6')).toBe(true);
    expect(isValidArcaCuit(' 20 12345678 6 ')).toBe(true);
  });

  it('rechaza un dígito verificador equivocado', () => {
    expect(isValidArcaCuit('20123456787')).toBe(false);
  });

  it('rechaza lo que no son 11 dígitos', () => {
    expect(isValidArcaCuit('2012345678')).toBe(false);
    expect(isValidArcaCuit('')).toBe(false);
  });
});

describe('normalizeArcaCuit', () => {
  it('deja sólo los dígitos', () => {
    expect(normalizeArcaCuit('20-12345678-6')).toBe('20123456786');
    expect(normalizeArcaCuit(' 20 12345678 6 ')).toBe('20123456786');
  });
});

describe('validateArcaCuit', () => {
  it('pide el CUIT si está vacío', () => {
    expect(validateArcaCuit('')).toBe('Ingresá el CUIT');
  });

  it('avisa "El CUIT no es válido" con el dígito verificador mal', () => {
    expect(validateArcaCuit('20123456787')).toBe('El CUIT no es válido');
  });

  it('no da error con un CUIT válido', () => {
    expect(validateArcaCuit('20-12345678-6')).toBeNull();
  });

  // El paso 1 del wizard dice "Con o sin guiones": con guiones o sin ellos
  // tiene que pasar exactamente igual, no sólo "los dos son válidos".
  it('pasa igual con o sin guiones', () => {
    expect(validateArcaCuit('20123456786')).toBe(
      validateArcaCuit('20-12345678-6'),
    );
    expect(validateArcaCuit('20123456786')).toBeNull();
  });
});
