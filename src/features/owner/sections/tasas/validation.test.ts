import { describe, expect, it } from 'vitest';
import type { Rate } from '../../services/rates';
import {
  canSubmitRateForm,
  diffRateUpdate,
  emptyRateForm,
  nextFreeShortcut,
  toMoneyInputString,
  validateMoney,
  validateRateForm,
} from './validation';

function makeRate(overrides: Partial<Rate> = {}): Rate {
  return {
    id: 'rate-1',
    tenantId: 'tenant-1',
    name: 'DIA AUTO',
    hourPriceArs: 3600,
    stayPriceArs: 8000,
    fractionPriceArs: 300,
    isActive: true,
    shortcutNumber: 1,
    version: 1,
    syncSeq: 1,
    createdAt: '2026-08-28T22:00:00.000Z',
    updatedAt: '2026-08-28T22:00:00.000Z',
    ...overrides,
  };
}

describe('validateMoney', () => {
  it('acepta enteros y hasta dos decimales, con punto o con coma', () => {
    expect(validateMoney('3600')).toEqual({ value: 3600 });
    expect(validateMoney('3600.5')).toEqual({ value: 3600.5 });
    expect(validateMoney('1,50')).toEqual({ value: 1.5 });
    expect(validateMoney('0')).toEqual({ value: 0 });
    expect(validateMoney('  120,25  ')).toEqual({ value: 120.25 });
  });

  it('exige el campo', () => {
    expect(validateMoney('').error).toBe('Este campo es obligatorio.');
    expect(validateMoney('   ').error).toBe('Este campo es obligatorio.');
  });

  it('rechaza texto, más de dos decimales y negativos', () => {
    const formatError = 'Ingresá un número válido con hasta 2 decimales.';
    expect(validateMoney('abc').error).toBe(formatError);
    expect(validateMoney('10.999').error).toBe(formatError);
    // El separador de miles no está soportado: se carga el número pelado.
    expect(validateMoney('1.234,56').error).toBe(formatError);
    expect(validateMoney('-5').error).toBe(formatError);
  });
});

describe('toMoneyInputString', () => {
  it('hace round-trip estable con validateMoney', () => {
    const text = toMoneyInputString(3600);
    expect(text).toBe('3600.00');
    expect(validateMoney(text)).toEqual({ value: 3600 });
  });
});

describe('nextFreeShortcut', () => {
  it('arranca en 1 cuando no hay tasas', () => {
    expect(nextFreeShortcut([])).toBe(1);
  });

  it('toma el primer hueco libre', () => {
    const rates = [
      makeRate({ id: 'a', shortcutNumber: 1 }),
      makeRate({ id: 'b', shortcutNumber: 3 }),
    ];
    expect(nextFreeShortcut(rates)).toBe(2);
  });

  it('ignora las tasas sin atajo asignado', () => {
    const rates = [
      makeRate({ id: 'a', shortcutNumber: 1 }),
      makeRate({ id: 'b', shortcutNumber: null }),
      makeRate({ id: 'c', shortcutNumber: 2 }),
    ];
    expect(nextFreeShortcut(rates)).toBe(3);
  });
});

describe('canSubmitRateForm', () => {
  it('pide todos los campos completos y válidos', () => {
    expect(canSubmitRateForm(emptyRateForm())).toBe(false);
    expect(
      canSubmitRateForm({
        shortcutNumber: '1',
        name: 'DIA AUTO',
        hourPriceArs: '3600',
        stayPriceArs: '8000',
        fractionPriceArs: '300',
      }),
    ).toBe(true);
  });

  it('no habilita si el atajo no es un entero positivo', () => {
    expect(
      canSubmitRateForm({
        shortcutNumber: '0',
        name: 'DIA AUTO',
        hourPriceArs: '3600',
        stayPriceArs: '8000',
        fractionPriceArs: '300',
      }),
    ).toBe(false);
  });
});

describe('validateRateForm', () => {
  const validForm = {
    shortcutNumber: '2',
    name: 'NOCHE AUTO',
    hourPriceArs: '4000',
    stayPriceArs: '9000',
    fractionPriceArs: '400',
  };

  it('devuelve el payload numérico cuando todo está bien', () => {
    const { errors, payload } = validateRateForm(validForm, {
      rates: [],
      editingId: null,
    });
    expect(errors).toEqual({});
    expect(payload).toEqual({
      shortcutNumber: 2,
      name: 'NOCHE AUTO',
      hourPriceArs: 4000,
      stayPriceArs: 9000,
      fractionPriceArs: 400,
    });
  });

  it('exige el nombre y corta en 120 caracteres', () => {
    expect(
      validateRateForm(
        { ...validForm, name: '   ' },
        {
          rates: [],
          editingId: null,
        },
      ).errors.name,
    ).toBe('El nombre es obligatorio.');

    expect(
      validateRateForm(
        { ...validForm, name: 'x'.repeat(121) },
        {
          rates: [],
          editingId: null,
        },
      ).errors.name,
    ).toBe('Máximo 120 caracteres.');
  });

  it('rechaza atajos que no sean el entero exacto', () => {
    for (const shortcutNumber of ['01', '1.5', '0', '-1', 'x']) {
      expect(
        validateRateForm(
          { ...validForm, shortcutNumber },
          {
            rates: [],
            editingId: null,
          },
        ).errors.shortcutNumber,
      ).toBe('Debe ser un entero positivo.');
    }
  });

  it('avisa qué tasa ocupa el atajo', () => {
    const { errors, payload } = validateRateForm(
      { ...validForm, shortcutNumber: '1' },
      { rates: [makeRate()], editingId: null },
    );
    expect(errors.shortcutNumber).toBe(
      'El número 1 ya está ocupado por "DIA AUTO".',
    );
    expect(payload).toBeUndefined();
  });

  it('no choca contra sí misma al editar', () => {
    const { errors } = validateRateForm(
      { ...validForm, shortcutNumber: '1' },
      { rates: [makeRate()], editingId: 'rate-1' },
    );
    expect(errors.shortcutNumber).toBeUndefined();
  });
});

describe('diffRateUpdate', () => {
  const current = makeRate();
  const payload = {
    shortcutNumber: 1,
    name: 'DIA AUTO',
    hourPriceArs: 3600,
    stayPriceArs: 8000,
    fractionPriceArs: 300,
  };

  it('devuelve vacío cuando no cambió nada', () => {
    expect(diffRateUpdate(payload, current)).toEqual({});
  });

  it('manda solo el campo que cambió', () => {
    expect(diffRateUpdate({ ...payload, hourPriceArs: 4000 }, current)).toEqual(
      {
        hourPriceArs: 4000,
      },
    );
  });

  it('detecta el alta de un atajo que estaba en null', () => {
    const sinAtajo = makeRate({ shortcutNumber: null });
    expect(diffRateUpdate(payload, sinAtajo)).toEqual({ shortcutNumber: 1 });
  });
});
