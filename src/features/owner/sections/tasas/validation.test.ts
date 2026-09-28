import { describe, expect, it } from 'vitest';
import type { Rate } from '../../services/rates';
import {
  canSubmitRateForm,
  diffRateUpdate,
  emptyRateForm,
  hasPriceChange,
  nextFreeShortcut,
  priceDiffRows,
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
    mediaEstadiaPriceArs: 4000,
    autoFractionPrice: false,
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
        mediaEstadiaPriceArs: '4000',
        autoFractionPrice: false,
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
        mediaEstadiaPriceArs: '4000',
        autoFractionPrice: false,
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
    mediaEstadiaPriceArs: '4000',
    autoFractionPrice: false,
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
      mediaEstadiaPriceArs: 4000,
      autoFractionPrice: false,
    });
  });

  it('rechaza una media estadía mayor que la estadía', () => {
    const { errors, payload } = validateRateForm(
      { ...validForm, mediaEstadiaPriceArs: '99000' },
      { rates: [], editingId: null },
    );
    expect(errors.mediaEstadiaPriceArs).toBe(
      'No puede superar el precio de la estadía.',
    );
    expect(payload).toBeUndefined();
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
    mediaEstadiaPriceArs: 4000,
    autoFractionPrice: false,
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

  it('manda la media estadía cuando cambió', () => {
    expect(
      diffRateUpdate({ ...payload, mediaEstadiaPriceArs: 4500 }, current),
    ).toEqual({ mediaEstadiaPriceArs: 4500 });
  });

  it('manda el flag de autocálculo cuando se tilda', () => {
    expect(
      diffRateUpdate({ ...payload, autoFractionPrice: true }, current),
    ).toEqual({ autoFractionPrice: true });
  });
});

describe('hasPriceChange', () => {
  it.each([
    ['hora', { hourPriceArs: 3900 }],
    ['fracción', { fractionPriceArs: 325 }],
    ['media estadía', { mediaEstadiaPriceArs: 5000 }],
    ['estadía', { stayPriceArs: 9800 }],
  ])('un cambio de %s dispara la pregunta', (_caso, body) => {
    expect(hasPriceChange(body)).toBe(true);
  });

  it.each([
    ['el nombre', { name: 'OTRO' }],
    ['el atajo', { shortcutNumber: 3 }],
    ['activar/desactivar', { isActive: false }],
  ])('un cambio de %s NO dispara la pregunta', (_caso, body) => {
    // Nada de esto cambia lo que se le cobra al auto.
    expect(hasPriceChange(body)).toBe(false);
  });

  it('el flag de fracción automática solo no cuenta', () => {
    // Es preferencia del formulario; el motor de cobro ni la mira.
    expect(hasPriceChange({ autoFractionPrice: true })).toBe(false);
  });

  it('pero si además reescribió la fracción, sí cuenta', () => {
    expect(
      hasPriceChange({ autoFractionPrice: true, fractionPriceArs: 325 }),
    ).toBe(true);
  });

  it('un body vacío no dispara nada', () => {
    expect(hasPriceChange({})).toBe(false);
  });

  it('un precio puesto en cero sigue siendo un cambio de precio', () => {
    // `0` es falsy: mirar presencia de clave y no el valor es lo que lo salva.
    expect(hasPriceChange({ mediaEstadiaPriceArs: 0 })).toBe(true);
  });
});

describe('priceDiffRows', () => {
  const actual = {
    name: 'NOCHE AUTO',
    hourPriceArs: 3500,
    stayPriceArs: 9000,
    fractionPriceArs: 290,
    mediaEstadiaPriceArs: 4500,
    autoFractionPrice: false,
  } as Parameters<typeof priceDiffRows>[1];

  it('devuelve sólo las filas que cambiaron, con antes y después', () => {
    expect(priceDiffRows({ hourPriceArs: 3900 }, actual)).toEqual([
      { label: 'Hora', before: 3500, after: 3900 },
    ]);
  });

  it('respeta el orden de lectura del formulario', () => {
    const rows = priceDiffRows(
      { stayPriceArs: 9800, hourPriceArs: 3900 },
      actual,
    );
    expect(rows.map((r) => r.label)).toEqual(['Hora', 'Estadía']);
  });

  it('sin cambios de precio no devuelve filas', () => {
    expect(priceDiffRows({ name: 'OTRO' }, actual)).toEqual([]);
  });
});
