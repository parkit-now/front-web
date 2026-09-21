import { describe, expect, it } from 'vitest';
import {
  canSubmitStaffEmail,
  normalizeStaffEmail,
  validateStaffEmail,
} from './validation';

describe('normalizeStaffEmail', () => {
  it('recorta y baja a minúsculas, como el backend', () => {
    expect(normalizeStaffEmail('  ANA@Example.COM ')).toBe('ana@example.com');
  });

  it('deja intacto un mail ya normalizado', () => {
    expect(normalizeStaffEmail('ana@example.com')).toBe('ana@example.com');
  });
});

describe('validateStaffEmail', () => {
  it('devuelve el mail normalizado cuando es válido', () => {
    expect(validateStaffEmail('  ANA@Example.COM ')).toEqual({
      email: 'ana@example.com',
    });
  });

  it('exige el campo', () => {
    expect(validateStaffEmail('   ').error).toBe(
      'Ingresá el email de la persona.',
    );
  });

  it.each(['ana', 'ana@', '@example.com', 'ana example.com', 'ana@example'])(
    'rechaza %j',
    (raw) => {
      expect(validateStaffEmail(raw).error).toBe('Email inválido.');
    },
  );

  it('rechaza mails de más de 255 caracteres, como la columna', () => {
    const long = `${'a'.repeat(250)}@example.com`;
    expect(validateStaffEmail(long).error).toBe('Máximo 255 caracteres.');
  });

  it('acepta uno de exactamente 255', () => {
    const exact = `${'a'.repeat(255 - '@example.com'.length)}@example.com`;
    expect(exact).toHaveLength(255);
    expect(validateStaffEmail(exact).email).toBe(exact);
  });

  it('no devuelve email cuando hay error', () => {
    expect(validateStaffEmail('ana').email).toBeUndefined();
  });
});

describe('canSubmitStaffEmail', () => {
  it('no habilita con espacios solos', () => {
    expect(canSubmitStaffEmail('   ')).toBe(false);
  });

  it('habilita apenas hay algo, sin pintar errores mientras tipea', () => {
    expect(canSubmitStaffEmail('a')).toBe(true);
  });
});
