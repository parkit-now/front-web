import { describe, expect, it } from 'vitest';
import { validateFullName, validatePasswordConfirmation } from './validation';

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

describe('validatePasswordConfirmation', () => {
  it('exige repetir la contraseña', () => {
    expect(validatePasswordConfirmation('abcd1234', '')).toBe(
      'Este campo es obligatorio.',
    );
  });

  it('falla si no coinciden', () => {
    expect(validatePasswordConfirmation('abcd1234', 'abcd12345')).toBe(
      'Las contraseñas no coinciden',
    );
  });

  it('distingue mayúsculas y no recorta espacios', () => {
    expect(validatePasswordConfirmation('abcd1234', 'ABCD1234')).toBe(
      'Las contraseñas no coinciden',
    );
    expect(validatePasswordConfirmation('abcd1234', 'abcd1234 ')).toBe(
      'Las contraseñas no coinciden',
    );
  });

  it('acepta cuando coinciden', () => {
    expect(validatePasswordConfirmation('abcd1234', 'abcd1234')).toBeNull();
  });
});
