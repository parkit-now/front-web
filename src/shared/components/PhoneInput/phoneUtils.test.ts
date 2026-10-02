import { describe, expect, it } from 'vitest';
import {
  applyTypedPhone,
  changePhoneCountry,
  filterPhoneCountries,
  formatPhoneForDisplay,
  getPhoneCountryOptions,
  getPhoneExample,
  parseStoredPhone,
  validatePhone,
} from './phoneUtils';

describe('validatePhone', () => {
  it('acepta un fijo argentino', () => {
    expect(validatePhone('+541123456789', { required: true })).toBeNull();
  });
  it('acepta un celular argentino con 9', () => {
    expect(validatePhone('+5491123456789', { required: true })).toBeNull();
  });
  it('acepta otros países (UY, US)', () => {
    expect(validatePhone('+59899123456')).toBeNull();
    expect(validatePhone('+12015550123')).toBeNull();
  });
  it('vacío: obligatorio da error, opcional no', () => {
    expect(validatePhone('', { required: true })).toBe(
      'Este campo es obligatorio.',
    );
    expect(validatePhone('  ', { required: true })).toBe(
      'Este campo es obligatorio.',
    );
    expect(validatePhone('', { required: false })).toBeNull();
    expect(validatePhone(undefined)).toBeNull();
  });
  it('inválido', () => {
    expect(validatePhone('+54123')).toBe('Ingresá un teléfono válido');
    expect(validatePhone('1123456789')).toBe('Ingresá un teléfono válido');
  });
});

describe('formatPhoneForDisplay', () => {
  it('formatea E.164 en internacional', () => {
    expect(formatPhoneForDisplay('+541123456789')).toBe('+54 11 2345 6789');
    expect(formatPhoneForDisplay('+5491123456789')).toBe('+54 9 11 2345 6789');
  });
  it('deja intacto un teléfono viejo no E.164', () => {
    expect(formatPhoneForDisplay('11 2345-6789')).toBe('11 2345-6789');
    expect(formatPhoneForDisplay('011-4444-5555')).toBe('011-4444-5555');
  });
  it('vacío', () => {
    expect(formatPhoneForDisplay('')).toBe('');
    expect(formatPhoneForDisplay(null)).toBe('');
  });
});

describe('parseStoredPhone', () => {
  it('ubica el país y el número nacional', () => {
    expect(parseStoredPhone('+541123456789')).toEqual({
      country: 'AR',
      text: '011 2345-6789',
    });
    expect(parseStoredPhone('+12015550123')?.country).toBe('US');
  });
  it('null para valores viejos', () => {
    expect(parseStoredPhone('11 2345-6789')).toBeNull();
    expect(parseStoredPhone('')).toBeNull();
  });
});

describe('applyTypedPhone', () => {
  it('AR fijo: formatea mientras se tipea y emite E.164', () => {
    const r = applyTypedPhone('01123456789', 'AR');
    expect(r.text).toBe('011 2345-6789');
    expect(r.e164).toBe('+541123456789');
  });
  it('AR sin 0 inicial', () => {
    const r = applyTypedPhone('1123456789', 'AR');
    expect(r.text).toBe('11 2345-6789');
    expect(r.e164).toBe('+541123456789');
  });
  it('AR celular con 9', () => {
    const r = applyTypedPhone('91123456789', 'AR');
    expect(r.e164).toBe('+5491123456789');
    expect(validatePhone(r.e164, { required: true })).toBeNull();
  });
  it('otro país (UY)', () => {
    const r = applyTypedPhone('099123456', 'UY');
    expect(r.country).toBe('UY');
    expect(r.e164).toBe('+59899123456');
  });
  it('pegar un número internacional cambia el país', () => {
    const r = applyTypedPhone('+12015550123', 'AR');
    expect(r.country).toBe('US');
    expect(r.e164).toBe('+12015550123');
  });
  it('parcial incompleto emite algo inválido, no vacío', () => {
    const r = applyTypedPhone('1123', 'AR');
    expect(r.e164).toBe('+541123');
    expect(validatePhone(r.e164)).toBe('Ingresá un teléfono válido');
  });
  it('vacío', () => {
    expect(applyTypedPhone('', 'AR')).toEqual({
      country: 'AR',
      text: '',
      e164: '',
    });
  });
  it('borrar un separador borra el dígito anterior', () => {
    const r = applyTypedPhone('0112345', 'AR', '011 2345');
    expect(r.text.replace(/\D/g, '')).toBe('011234');
  });
});

describe('changePhoneCountry', () => {
  it('conserva los dígitos y cambia el prefijo', () => {
    const r = changePhoneCountry('11 2345-6789', 'UY');
    expect(r.country).toBe('UY');
    expect(r.e164.startsWith('+598')).toBe(true);
  });
});

describe('getPhoneExample', () => {
  it('AR muestra un fijo', () => {
    expect(getPhoneExample('AR')).toBe('011 2345-6789');
  });
  it('otros países usan getExampleNumber', () => {
    expect(getPhoneExample('US')).toBe('(201) 555-0123');
  });
});

describe('países', () => {
  const options = getPhoneCountryOptions();
  it('Argentina primero y en español', () => {
    expect(options[0].code).toBe('AR');
    expect(options[0].name).toBe('Argentina');
    expect(options.find((o) => o.code === 'US')?.name).toBe('Estados Unidos');
  });
  it('busca por nombre sin tildes, código y prefijo', () => {
    expect(filterPhoneCountries(options, 'uruguay')[0].code).toBe('UY');
    expect(
      filterPhoneCountries(options, 'brasil').map((o) => o.code),
    ).toContain('BR');
    expect(filterPhoneCountries(options, '+598').map((o) => o.code)).toContain(
      'UY',
    );
  });
});
