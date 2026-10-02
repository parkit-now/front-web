import { describe, expect, it } from 'vitest';
import { validateFullName } from './validation';

describe('validateFullName', () => {
  it('exige un valor', () => {
    expect(validateFullName('')).toBe('Este campo es obligatorio.');
    expect(validateFullName('   ')).toBe('Este campo es obligatorio.');
  });

  it('exige nombre y apellido', () => {
    expect(validateFullName('Juan')).toBe('Ingresá tu nombre y apellido');
    expect(validateFullName('  Juan  ')).toBe('Ingresá tu nombre y apellido');
  });

  it('acepta dos o más palabras', () => {
    expect(validateFullName('Juan Pérez')).toBeNull();
    expect(validateFullName('  María   de la Cruz ')).toBeNull();
  });
});
