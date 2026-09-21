import { describe, expect, it } from 'vitest';
import {
  emptyAddress,
  type AddressFormValue,
} from '../../shared/components/AddressPicker/addressUtils';
import {
  validateAddress,
  validateName,
  validateSucursalForm,
} from './validation';

/** Dirección tal como la deja Georef: origen `georef` y línea de display. */
function georefAddress(
  overrides: Partial<AddressFormValue> = {},
): AddressFormValue {
  return {
    ...emptyAddress(),
    formatted: 'Avenida Corrientes 1234, Balvanera, CABA',
    streetName: 'Avenida Corrientes',
    streetNumber: '1234',
    cityName: 'Balvanera',
    stateName: 'Ciudad Autónoma de Buenos Aires',
    latitude: -34.603722,
    longitude: -58.381592,
    geocodingSource: 'georef',
    geocodedAt: '2026-09-13T16:46:17.000Z',
    ...overrides,
  };
}

/** Dirección cargada a mano, completa: Georef nunca la vio. */
function manualAddress(
  overrides: Partial<AddressFormValue> = {},
): AddressFormValue {
  return {
    ...emptyAddress(),
    formatted: 'Avenida Corrientes 1234, Balvanera, CABA',
    streetName: 'Avenida Corrientes',
    streetNumber: '1234',
    cityName: 'Balvanera',
    stateName: 'Ciudad Autónoma de Buenos Aires',
    geocodingSource: 'manual',
    geocodedAt: '2026-09-13T16:46:17.000Z',
    ...overrides,
  };
}

describe('validateAddress', () => {
  it('exige el domicilio: vacío ya no pasa', () => {
    expect(validateAddress(emptyAddress())).toBeTruthy();
  });

  it('con Georef resuelto alcanza: la persona no tocó ningún campo', () => {
    expect(validateAddress(georefAddress())).toBeNull();
  });

  // El punto del ticket: un servicio del Estado caído NO puede frenar el alta.
  it('sin Georef, la carga manual completa también pasa', () => {
    expect(validateAddress(manualAddress())).toBeNull();
  });

  it('NO exige coordenadas: sin Georef no hay, y el pin es opcional', () => {
    const sinPin = manualAddress({ latitude: null, longitude: null });
    expect(validateAddress(sinPin)).toBeNull();
  });

  it('NO exige piso ni código postal', () => {
    const sinExtras = manualAddress({ floor: '', postalCode: '' });
    expect(validateAddress(sinExtras)).toBeNull();
  });

  it.each([
    ['streetName', 'la calle'],
    ['streetNumber', 'la altura'],
    ['cityName', 'la localidad'],
    ['stateName', 'la provincia'],
  ] as const)('en carga manual exige %s y lo nombra', (field, label) => {
    const error = validateAddress(manualAddress({ [field]: '' }));
    expect(error).toContain(label);
  });

  it('enumera TODO lo que falta, no sólo el primero', () => {
    const error = validateAddress(
      manualAddress({ cityName: '', stateName: '' }),
    );
    expect(error).toContain('la localidad');
    expect(error).toContain('la provincia');
  });

  // Un `formatted` suelto sin los campos separados es la forma VIEJA del
  // borrador (sólo `address` plano). Mercado Pago necesita los campos
  // separados, así que la línea sola no alcanza.
  it('la línea de display sola no alcanza si no la normalizó Georef', () => {
    const legacy = {
      ...emptyAddress(),
      formatted: 'Av. Corrientes 1234',
    };
    expect(validateAddress(legacy)).toBeTruthy();
  });

  // Corregir a mano una dirección de Georef pasa el origen a `manual`: ahí
  // dejan de valer los atajos y se exigen los cuatro campos.
  it('una dirección de Georef corregida a mano sigue siendo válida si está completa', () => {
    const corregida = georefAddress({
      geocodingSource: 'manual',
      streetNumber: '1236',
    });
    expect(validateAddress(corregida)).toBeNull();
  });

  it('una dirección de Georef vaciada a mano deja de ser válida', () => {
    const rota = georefAddress({ geocodingSource: 'manual', cityName: '' });
    expect(validateAddress(rota)).toContain('la localidad');
  });

  // ── El mínimo es el MISMO por los dos caminos ────────────────────────────
  //
  // Antes `isGeorefNormalized()` era un atajo: con origen `georef` y línea de
  // display, la validación no miraba un solo campo. O sea, el formulario le
  // exigía a la persona lo que no le exigía a la API — y una respuesta a
  // medias de Georef llegaba a Mercado Pago sin los campos del `Store`.

  it.each([
    ['streetName', 'la calle'],
    ['streetNumber', 'la altura'],
    ['cityName', 'la localidad'],
    ['stateName', 'la provincia'],
  ] as const)(
    'una respuesta de Georef SIN %s tampoco pasa: la exige igual',
    (field, label) => {
      // Georef la normalizó, tiene `nomenclatura` y hasta coordenadas… pero le
      // falta un campo que Mercado Pago necesita.
      const aMedias = georefAddress({ [field]: '' });
      expect(aMedias.geocodingSource).toBe('georef');
      expect(aMedias.formatted).not.toBe('');
      expect(validateAddress(aMedias)).toContain(label);
    },
  );

  it('el caso real: buscar una calle sin altura no alcanza para el alta', () => {
    const sinAltura = georefAddress({
      formatted: 'AV CABILDO, Comuna 13, CABA',
      streetNumber: '',
    });
    expect(validateAddress(sinAltura)).toContain('la altura');
  });

  it.each(['georef', 'manual'] as const)(
    'con origen %s el mínimo exigido es exactamente el mismo',
    (origen) => {
      const completa = georefAddress({ geocodingSource: origen });
      const incompleta = georefAddress({
        geocodingSource: origen,
        cityName: '',
      });
      expect(validateAddress(completa)).toBeNull();
      expect(validateAddress(incompleta)).toContain('la localidad');
    },
  );

  it('Georef normalizando BIEN sigue pasando sin tocar nada', () => {
    // La regresión que hay que no cometer arreglando lo de arriba.
    expect(validateAddress(georefAddress())).toBeNull();
    expect(
      validateSucursalForm({ name: 'Centro', address: georefAddress() }),
    ).toEqual({});
  });
});

describe('validateAddress con el catálogo de Mercado Pago', () => {
  it('frena una localidad completa que Mercado Pago no conoce', () => {
    // El borrador viejo del ticket: "Martínez" está lleno y prolijo, pasa el
    // chequeo de campos faltantes, y es EL valor con el que la vinculación se
    // cae. Antes se iba derecho al backend.
    const martinez = georefAddress({
      cityName: 'Martínez',
      stateName: 'Buenos Aires',
    });
    expect(validateAddress(martinez)).toContain('la localidad');
  });

  it('nombra la provincia cuando la que está guardada no existe', () => {
    const rota = manualAddress({ stateName: 'Bs. As.', cityName: 'La Plata' });
    expect(validateAddress(rota)).toContain('la provincia');
  });

  it('el mensaje explica que el problema es Mercado Pago', () => {
    const martinez = georefAddress({
      cityName: 'Martínez',
      stateName: 'Buenos Aires',
    });
    expect(validateAddress(martinez)).toContain('Mercado Pago');
  });

  it('deja pasar la misma dirección con la localidad corregida', () => {
    const corregida = georefAddress({
      cityName: 'San Isidro',
      stateName: 'Buenos Aires',
    });
    expect(validateAddress(corregida)).toBeNull();
  });

  it('el campo vacío sigue hablando de lo que FALTA, no de Mercado Pago', () => {
    // Un solo problema, un solo mensaje: decir las dos cosas manda a buscar
    // dos errores donde hay uno.
    const error = validateAddress(manualAddress({ cityName: '' }));
    expect(error).toContain('falta');
    expect(error).not.toContain('Mercado Pago');
  });
});

describe('validateName', () => {
  it('exige el nombre', () => {
    expect(validateName('')).toBeTruthy();
    expect(validateName('   ')).toBeTruthy();
  });

  it('acepta un nombre cargado', () => {
    expect(validateName('Playa Centro')).toBeNull();
  });
});

describe('validateSucursalForm', () => {
  const base = { name: 'Playa', address: georefAddress() };

  it('acepta el formulario mínimo: nombre + domicilio', () => {
    expect(validateSucursalForm(base)).toEqual({});
  });

  it('exige el nombre', () => {
    const errors = validateSucursalForm({ ...base, name: '' });
    expect(errors.name).toBeTruthy();
  });

  // Antes el domicilio era opcional (era opcional en el contrato). El usuario
  // pidió que el alta no avance sin dirección: la obligatoriedad es del
  // FORMULARIO, las columnas de `tenants` siguen siendo nullable.
  it('exige el domicilio', () => {
    const errors = validateSucursalForm({ ...base, address: emptyAddress() });
    expect(errors.address).toBeTruthy();
  });

  it('reporta los dos errores juntos', () => {
    const errors = validateSucursalForm({ name: '', address: emptyAddress() });
    expect(errors.name).toBeTruthy();
    expect(errors.address).toBeTruthy();
  });
});
