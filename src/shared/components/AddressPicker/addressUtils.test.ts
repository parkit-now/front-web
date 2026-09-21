import { describe, expect, it } from 'vitest';
import type { GeocodedAddress } from '../../../lib/geocoding/GeocodingProvider';
import {
  addressFromGeocoded,
  addressFromLocation,
  addressPrimaryLine,
  addressSummaryDetail,
  applyCatalogToGeocoded,
  composeFormatted,
  describeGeocodingSource,
  emptyAddress,
  hasCoordinates,
  isAddressEmpty,
  isGeorefNormalized,
  missingAddressFields,
  moveAddressPin,
  setAddressDetailField,
  setAddressField,
  setAddressProvince,
  toDeclaredLocation,
  toUpdateAddressDto,
  unrecognizedAddressFields,
  type AddressFormValue,
} from './addressUtils';

const NOW = new Date('2026-09-13T16:46:17.000Z');

const GEOCODED: GeocodedAddress = {
  formatted: 'AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires',
  streetName: 'AV CORRIENTES',
  streetNumber: '1234',
  floor: null,
  cityName: 'Ciudad Autónoma de Buenos Aires',
  stateName: 'Ciudad Autónoma de Buenos Aires',
  postalCode: null,
  latitude: -34.603856,
  longitude: -58.38419,
};

function filled(): AddressFormValue {
  return addressFromGeocoded(GEOCODED, emptyAddress(), NOW);
}

describe('addressFromLocation', () => {
  it('mapea una dirección completa', () => {
    const value = addressFromLocation({
      formatted: 'Av. Corrientes 1234, CABA',
      streetName: 'Avenida Corrientes',
      streetNumber: '1234',
      floor: 'PB',
      cityName: 'Balvanera',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1043',
      latitude: -34.603722,
      longitude: -58.381592,
      geocodingSource: 'georef',
      geocodedAt: '2026-09-13T16:46:17.000Z',
    });

    expect(value.streetName).toBe('Avenida Corrientes');
    expect(value.latitude).toBe(-34.603722);
    expect(value.geocodingSource).toBe('georef');
  });

  // El caso del tenant viejo: la migración no hizo backfill.
  it('no se rompe con `location` ausente, null o vacío', () => {
    expect(addressFromLocation(undefined)).toEqual(emptyAddress());
    expect(addressFromLocation(null)).toEqual(emptyAddress());
    expect(addressFromLocation({})).toEqual(emptyAddress());
  });

  it('cae a la columna `address` de siempre cuando no hay `formatted`', () => {
    const value = addressFromLocation(
      { formatted: null },
      'Bartolomé Mitre 2500, CABA',
    );
    expect(value.formatted).toBe('Bartolomé Mitre 2500, CABA');
    expect(value.streetName).toBe('');
    expect(value.geocodingSource).toBeNull();
  });

  it('ignora media coordenada en vez de dibujar un pin mentiroso', () => {
    const value = addressFromLocation({ latitude: -34.6, longitude: null });
    expect(value.latitude).toBeNull();
    expect(value.longitude).toBeNull();
  });

  it('descarta un `geocodingSource` que no sea del conjunto cerrado', () => {
    const value = addressFromLocation({
      geocodingSource: 'google' as never,
    });
    expect(value.geocodingSource).toBeNull();
  });
});

describe('addressFromGeocoded', () => {
  it('elegir un candidato de Georef deja el origen en `georef`', () => {
    const value = addressFromGeocoded(GEOCODED, emptyAddress(), NOW);
    expect(value.geocodingSource).toBe('georef');
    expect(value.geocodedAt).toBe('2026-09-13T16:46:17.000Z');
    expect(value.streetNumber).toBe('1234');
  });

  it('conserva el código postal previo: Georef no lo devuelve', () => {
    const previous = { ...emptyAddress(), postalCode: 'C1043' };
    expect(addressFromGeocoded(GEOCODED, previous, NOW).postalCode).toBe(
      'C1043',
    );
  });

  it('conserva el piso previo cuando Georef no trae uno', () => {
    const previous = { ...emptyAddress(), floor: '3 B' };
    expect(addressFromGeocoded(GEOCODED, previous, NOW).floor).toBe('3 B');
  });
});

describe('setAddressField', () => {
  it('editar a mano pasa el origen a `manual`', () => {
    const value = setAddressField(filled(), 'streetName', 'Corrientes', NOW);
    expect(value.streetName).toBe('Corrientes');
    expect(value.geocodingSource).toBe('manual');
  });

  it('un onChange con el MISMO texto no ensucia el origen', () => {
    const before = filled();
    const after = setAddressField(before, 'streetName', before.streetName, NOW);
    expect(after).toBe(before);
    expect(after.geocodingSource).toBe('georef');
  });

  it('no toca las coordenadas', () => {
    const value = setAddressField(filled(), 'floor', 'PB', NOW);
    expect(value.latitude).toBe(-34.603856);
    expect(value.longitude).toBe(-58.38419);
  });
});

describe('moveAddressPin', () => {
  it('arrastrar el pin pasa el origen a `manual`', () => {
    const value = moveAddressPin(filled(), -34.61, -58.39, NOW);
    expect(value.geocodingSource).toBe('manual');
    expect(value.latitude).toBe(-34.61);
    expect(value.longitude).toBe(-58.39);
    expect(value.geocodedAt).toBe('2026-09-13T16:46:17.000Z');
  });

  it('redondea a 6 decimales: Leaflet devuelve muchos más', () => {
    const value = moveAddressPin(
      filled(),
      -34.60385632930893,
      -58.38419018127011,
      NOW,
    );
    expect(value.latitude).toBe(-34.603856);
    expect(value.longitude).toBe(-58.38419);
  });

  it('no pisa el texto de la dirección', () => {
    const value = moveAddressPin(filled(), -34.61, -58.39, NOW);
    expect(value.streetName).toBe('AV CORRIENTES');
  });
});

describe('isAddressEmpty / hasCoordinates', () => {
  it('una dirección recién creada está vacía', () => {
    expect(isAddressEmpty(emptyAddress())).toBe(true);
    expect(hasCoordinates(emptyAddress())).toBe(false);
  });

  it('los espacios en blanco no cuentan como dato', () => {
    expect(isAddressEmpty({ ...emptyAddress(), streetName: '   ' })).toBe(true);
  });

  it('con sólo coordenadas ya no está vacía', () => {
    const value = { ...emptyAddress(), latitude: -34.6, longitude: -58.4 };
    expect(isAddressEmpty(value)).toBe(false);
    expect(hasCoordinates(value)).toBe(true);
  });
});

describe('toUpdateAddressDto', () => {
  it('manda los campos separados y el par de coordenadas completo', () => {
    expect(toUpdateAddressDto(filled())).toEqual({
      formatted:
        'AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires',
      streetName: 'AV CORRIENTES',
      streetNumber: '1234',
      floor: null,
      cityName: 'Ciudad Autónoma de Buenos Aires',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      postalCode: null,
      latitude: -34.603856,
      longitude: -58.38419,
      geocodingSource: 'georef',
      geocodedAt: '2026-09-13T16:46:17.000Z',
    });
  });

  it('los campos vacíos van como `null` explícito, para que borrar borre', () => {
    const dto = toUpdateAddressDto({ ...filled(), floor: '  ' });
    expect(dto.floor).toBeNull();
  });

  it('recorta los espacios sobrantes', () => {
    const dto = toUpdateAddressDto({ ...filled(), postalCode: '  C1043  ' });
    expect(dto.postalCode).toBe('C1043');
  });

  it('nunca manda media coordenada: el CHECK de la base la rechaza', () => {
    const dto = toUpdateAddressDto({ ...filled(), longitude: null });
    expect(dto.latitude).toBeNull();
    expect(dto.longitude).toBeNull();
  });

  it('una dirección vacía limpia también el origen y la fecha', () => {
    const dto = toUpdateAddressDto({
      ...emptyAddress(),
      geocodingSource: 'georef',
      geocodedAt: NOW.toISOString(),
    });
    expect(dto.geocodingSource).toBeNull();
    expect(dto.geocodedAt).toBeNull();
    expect(dto.formatted).toBeNull();
  });

  it('redondea a 6 decimales lo que venga con más precisión', () => {
    const dto = toUpdateAddressDto({
      ...filled(),
      latitude: -34.60385632930893,
      longitude: -58.38419018127011,
    });
    expect(dto.latitude).toBe(-34.603856);
    expect(dto.longitude).toBe(-58.38419);
  });
});

describe('toDeclaredLocation', () => {
  it('omite `location` cuando no se cargó nada: la dirección es opcional', () => {
    expect(toDeclaredLocation(emptyAddress())).toBeUndefined();
  });

  it('manda el objeto cuando hay aunque sea un campo', () => {
    const value = { ...emptyAddress(), formatted: 'Av. Corrientes 1234' };
    expect(toDeclaredLocation(value)?.formatted).toBe('Av. Corrientes 1234');
  });
});

describe('describeGeocodingSource', () => {
  it('traduce el origen para mostrarlo', () => {
    expect(describeGeocodingSource('georef')).toBe('Normalizada con Georef');
    expect(describeGeocodingSource('manual')).toBe('Cargada manualmente');
    expect(describeGeocodingSource(null)).toBeNull();
  });
});

describe('composeFormatted', () => {
  it('arma la línea con la forma de la nomenclatura de Georef', () => {
    const value = {
      ...emptyAddress(),
      streetName: 'Avenida Corrientes',
      streetNumber: '1234',
      cityName: 'Balvanera',
      stateName: 'Ciudad Autónoma de Buenos Aires',
    };
    expect(composeFormatted(value)).toBe(
      'Avenida Corrientes 1234, Balvanera, Ciudad Autónoma de Buenos Aires',
    );
  });

  it('no deja comas ni espacios colgando cuando faltan piezas', () => {
    const value = { ...emptyAddress(), streetName: 'Avenida Corrientes' };
    expect(composeFormatted(value)).toBe('Avenida Corrientes');
  });

  it('con todo vacío devuelve vacío, no una hilera de comas', () => {
    expect(composeFormatted(emptyAddress())).toBe('');
  });

  // El caso REAL visto en la base. Georef manda `localidad_censal` y
  // `provincia` con el MISMO texto para CABA (su `nomenclatura` usa otra:
  // "AV CABILDO 2000, Comuna 13, CABA"), así que concatenar sin mirar escribía
  // "Ciudad Autónoma de Buenos Aires" dos veces.
  it('NO duplica la localidad cuando es igual a la provincia (CABA)', () => {
    const caba = {
      ...emptyAddress(),
      streetName: 'AV CABILDO',
      streetNumber: '2000',
      cityName: 'Ciudad Autónoma de Buenos Aires',
      stateName: 'Ciudad Autónoma de Buenos Aires',
    };
    expect(composeFormatted(caba)).toBe(
      'AV CABILDO 2000, Ciudad Autónoma de Buenos Aires',
    );
  });

  it('compara sin tildes, sin puntuación y sin mayúsculas', () => {
    const value = {
      ...emptyAddress(),
      streetName: 'AV CABILDO',
      streetNumber: '2000',
      cityName: 'C.A.B.A.',
      stateName: 'caba',
    };
    expect(composeFormatted(value)).toBe('AV CABILDO 2000, C.A.B.A.');
  });

  it('localidad y provincia DISTINTAS van las dos, como siempre', () => {
    const value = {
      ...emptyAddress(),
      streetName: 'Av. Rivadavia',
      streetNumber: '100',
      cityName: 'Ramos Mejía',
      stateName: 'Buenos Aires',
    };
    expect(composeFormatted(value)).toBe(
      'Av. Rivadavia 100, Ramos Mejía, Buenos Aires',
    );
  });

  it('sin altura no deja un espacio colgando después de la calle', () => {
    const value = {
      ...emptyAddress(),
      streetName: 'Av. Cabildo',
      cityName: 'Belgrano',
      stateName: 'CABA',
    };
    expect(composeFormatted(value)).toBe('Av. Cabildo, Belgrano, CABA');
  });
});

describe('setAddressDetailField', () => {
  it('recompone la línea de display al corregir un campo', () => {
    // Sin esto, la pantalla mostraría la dirección vieja de Georef y la base
    // guardaría la nueva.
    const next = setAddressDetailField(filled(), 'cityName', 'Balvanera', NOW);
    expect(next.cityName).toBe('Balvanera');
    expect(next.formatted).toContain('Balvanera');
    expect(next.formatted).not.toContain('Comuna 1');
  });

  it('pasa el origen a manual, igual que la edición suelta', () => {
    const next = setAddressDetailField(filled(), 'streetNumber', '1236', NOW);
    expect(next.geocodingSource).toBe('manual');
  });

  it('un onChange con el MISMO texto no ensucia nada', () => {
    const value = filled();
    expect(setAddressDetailField(value, 'streetNumber', '1234', NOW)).toBe(
      value,
    );
  });

  // El caso EXACTO del hallazgo: corregir la altura de una dirección porteña
  // recomponía "…, Ciudad Autónoma de Buenos Aires, Ciudad Autónoma de Buenos
  // Aires".
  it('al recomponer una dirección de CABA no duplica la localidad', () => {
    const georefCaba: AddressFormValue = {
      ...emptyAddress(),
      formatted: 'AV CABILDO 2000, Comuna 13, CABA',
      streetName: 'AV CABILDO',
      streetNumber: '2000',
      cityName: 'Ciudad Autónoma de Buenos Aires',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      geocodingSource: 'georef',
      geocodedAt: NOW.toISOString(),
    };
    const next = setAddressDetailField(georefCaba, 'streetNumber', '2002', NOW);
    expect(next.formatted).toBe(
      'AV CABILDO 2002, Ciudad Autónoma de Buenos Aires',
    );
  });

  // `floor` y `postalCode` NO salen en la línea de display: recomponer al
  // tocarlos sólo servía para tirar la `nomenclatura` de Georef, que es más
  // legible que la que armamos nosotros.
  it.each(['floor', 'postalCode'] as const)(
    'tocar %s NO pisa la nomenclatura de Georef',
    (field) => {
      const value = filled();
      const next = setAddressDetailField(value, field, 'PB', NOW);
      expect(next.formatted).toBe(value.formatted);
      expect(next.formatted).toContain('Comuna 1');
      // Sigue marcando el origen como manual: el dato ya no es el de Georef.
      expect(next.geocodingSource).toBe('manual');
    },
  );
});

describe('isGeorefNormalized', () => {
  it('es true sólo con origen georef Y línea de display', () => {
    expect(isGeorefNormalized(filled())).toBe(true);
    expect(isGeorefNormalized({ ...filled(), formatted: '' })).toBe(false);
    expect(isGeorefNormalized({ ...filled(), geocodingSource: 'manual' })).toBe(
      false,
    );
    expect(isGeorefNormalized(emptyAddress())).toBe(false);
  });
});

describe('missingAddressFields', () => {
  it('con la carga manual completa no falta nada', () => {
    expect(missingAddressFields(filled())).toEqual([]);
  });

  it('NO pide piso ni código postal: Georef tampoco los devuelve', () => {
    const value = { ...filled(), floor: '', postalCode: '' };
    expect(missingAddressFields(value)).toEqual([]);
  });

  it('nombra los cuatro campos que pide Mercado Pago', () => {
    expect(missingAddressFields(emptyAddress())).toEqual([
      'streetName',
      'streetNumber',
      'cityName',
      'stateName',
    ]);
  });

  it('ignora el whitespace', () => {
    const value = { ...filled(), cityName: '   ' };
    expect(missingAddressFields(value)).toEqual(['cityName']);
  });
});

describe('addressPrimaryLine', () => {
  it('usa la línea de display cuando existe', () => {
    expect(addressPrimaryLine(filled())).toBe(GEOCODED.formatted);
  });

  it('cae a calle + altura cuando no hay línea', () => {
    const value = { ...filled(), formatted: '' };
    expect(addressPrimaryLine(value)).toBe('AV CORRIENTES 1234');
  });

  it('vacío no inventa nada', () => {
    expect(addressPrimaryLine(emptyAddress())).toBe('');
  });
});

describe('addressSummaryDetail', () => {
  it('no repite localidad ni provincia: ya están en la nomenclatura', () => {
    expect(addressSummaryDetail(filled())).toBe('');
  });

  it('muestra piso y CP, que Georef nunca devuelve', () => {
    const value = { ...filled(), floor: 'PB', postalCode: 'C1043' };
    expect(addressSummaryDetail(value)).toBe('Piso PB · CP C1043');
  });

  it('sin línea de display sí muestra localidad y provincia', () => {
    const value = {
      ...emptyAddress(),
      cityName: 'Balvanera',
      stateName: 'CABA',
    };
    expect(addressSummaryDetail(value)).toBe('Balvanera · CABA');
  });
});

describe('applyCatalogToGeocoded', () => {
  it('traduce la provincia de Georef al nombre que usa Mercado Pago', () => {
    // Georef dice "Ciudad Autónoma de Buenos Aires"; MP escribe "Capital Federal".
    expect(applyCatalogToGeocoded(filled()).stateName).toBe('Capital Federal');
  });

  it('VACÍA la localidad que Mercado Pago no conoce — el bug de "Martínez"', () => {
    const georef = {
      ...emptyAddress(),
      cityName: 'Martínez',
      stateName: 'Buenos Aires',
    };
    const next = applyCatalogToGeocoded(georef);
    expect(next.stateName).toBe('Buenos Aires');
    // Vacía y NO "San Isidro": adivinar el mapeo es inventar.
    expect(next.cityName).toBe('');
  });

  it('deja la localidad vacía como campo faltante, para que la UI la pida', () => {
    const georef = {
      ...filled(),
      cityName: 'Martínez',
      stateName: 'Buenos Aires',
    };
    expect(missingAddressFields(applyCatalogToGeocoded(georef))).toEqual([
      'cityName',
    ]);
  });

  it('conserva la localidad que sí está en el catálogo, con su tilde', () => {
    const georef = {
      ...emptyAddress(),
      cityName: 'villa gesell',
      stateName: 'buenos aires',
    };
    const next = applyCatalogToGeocoded(georef);
    expect(next.stateName).toBe('Buenos Aires');
    expect(next.cityName).toBe('Villa Gesell');
  });

  it('vacía la provincia desconocida en vez de guardar lo que MP rechaza', () => {
    const georef = { ...emptyAddress(), cityName: 'x', stateName: 'Atlántida' };
    expect(applyCatalogToGeocoded(georef)).toMatchObject({
      stateName: '',
      cityName: '',
    });
  });

  it('no toca el resto de los campos ni la nomenclatura de Georef', () => {
    const next = applyCatalogToGeocoded(filled());
    expect(next.formatted).toBe(GEOCODED.formatted);
    expect(next.streetName).toBe('AV CORRIENTES');
    expect(next.latitude).toBe(-34.603856);
    expect(next.geocodingSource).toBe('georef');
  });
});

describe('setAddressProvince', () => {
  const laPlata: AddressFormValue = {
    ...emptyAddress(),
    streetName: 'Calle 7',
    streetNumber: '1234',
    cityName: 'La Plata',
    stateName: 'Buenos Aires',
  };

  it('limpia la localidad que no pertenece a la provincia nueva', () => {
    const next = setAddressProvince(laPlata, 'Córdoba', NOW);
    expect(next.stateName).toBe('Córdoba');
    expect(next.cityName).toBe('');
  });

  it('conserva la localidad cuando sí pertenece a la provincia nueva', () => {
    // Un tenant viejo con la provincia escrita a mano: arreglarla no puede
    // costarle la localidad, que ya era correcta.
    const suelto = { ...laPlata, stateName: 'Bs. As.' };
    const next = setAddressProvince(suelto, 'Buenos Aires', NOW);
    expect(next.stateName).toBe('Buenos Aires');
    expect(next.cityName).toBe('La Plata');
  });

  it('recompone la línea de display en la misma transición', () => {
    expect(setAddressProvince(laPlata, 'Córdoba', NOW).formatted).toBe(
      'Calle 7 1234, Córdoba',
    );
  });

  it('marca el origen como manual', () => {
    const next = setAddressProvince(laPlata, 'Córdoba', NOW);
    expect(next.geocodingSource).toBe('manual');
    expect(next.geocodedAt).toBe(NOW.toISOString());
  });

  it('elegir la opción vacía limpia las dos cosas', () => {
    const next = setAddressProvince(laPlata, '', NOW);
    expect(next.stateName).toBe('');
    expect(next.cityName).toBe('');
  });

  it('re-elegir la misma provincia NO borra la localidad ni ensucia el origen', () => {
    // Sin esto, un re-render que repite el `onChange` le borraría la localidad
    // a alguien que no tocó nada.
    const next = setAddressProvince(laPlata, 'Buenos Aires', NOW);
    expect(next).toBe(laPlata);
  });

  it('con una localidad vieja no reconocida la limpia al confirmar la provincia', () => {
    const martinez = { ...laPlata, cityName: 'Martínez' };
    expect(setAddressProvince(martinez, 'Buenos Aires', NOW).cityName).toBe('');
  });
});

describe('composeFormatted con los valores del catálogo', () => {
  it('ya no necesita deduplicar CABA: son dos strings distintos', () => {
    // Antes Georef devolvía "Ciudad Autónoma de Buenos Aires" en localidad Y
    // provincia, y `composeFormatted` tenía que tirar una. Con el catálogo son
    // "Palermo" y "Capital Federal": las dos partes entran.
    const value = {
      ...emptyAddress(),
      streetName: 'AV CABILDO',
      streetNumber: '2000',
      cityName: 'Palermo',
      stateName: 'Capital Federal',
    };
    expect(composeFormatted(value)).toBe(
      'AV CABILDO 2000, Palermo, Capital Federal',
    );
  });

  it('sigue deduplicando los datos viejos que tienen la parte repetida', () => {
    const legacy = {
      ...emptyAddress(),
      streetName: 'AV CABILDO',
      streetNumber: '2000',
      cityName: 'Ciudad Autónoma de Buenos Aires',
      stateName: 'Ciudad Autónoma de Buenos Aires',
    };
    expect(composeFormatted(legacy)).toBe(
      'AV CABILDO 2000, Ciudad Autónoma de Buenos Aires',
    );
  });
});

describe('unrecognizedAddressFields', () => {
  const base: AddressFormValue = {
    ...emptyAddress(),
    streetName: 'Av. Santa Fe',
    streetNumber: '1234',
  };

  it('no se queja de los campos vacíos: de eso habla missingAddressFields', () => {
    expect(unrecognizedAddressFields(emptyAddress())).toEqual([]);
  });

  it('no se queja de un par que el catálogo conoce', () => {
    const value = {
      ...base,
      stateName: 'Buenos Aires',
      cityName: 'San Isidro',
    };
    expect(unrecognizedAddressFields(value)).toEqual([]);
  });

  it('marca la localidad que Mercado Pago no conoce aunque esté completa', () => {
    // El caso del ticket: "Martínez" pasa `missingAddressFields` (está lleno) y
    // es justo el valor con el que la vinculación se cae.
    const martinez = {
      ...base,
      stateName: 'Buenos Aires',
      cityName: 'Martínez',
    };
    expect(missingAddressFields(martinez)).toEqual([]);
    expect(unrecognizedAddressFields(martinez)).toEqual(['cityName']);
  });

  it('marca las dos, provincia primero, que es el orden en que se arreglan', () => {
    const value = { ...base, stateName: 'Bs. As.', cityName: 'Martínez' };
    expect(unrecognizedAddressFields(value)).toEqual(['stateName', 'cityName']);
  });

  it('tolera tildes y mayúsculas antes de acusar a nadie', () => {
    const value = { ...base, stateName: 'CORDOBA', cityName: 'cordoba' };
    expect(unrecognizedAddressFields(value)).toEqual([]);
  });

  it('acepta el nombre que Georef le da a CABA en la provincia', () => {
    const value = {
      ...base,
      stateName: 'Ciudad Autónoma de Buenos Aires',
      cityName: 'Palermo',
    };
    expect(unrecognizedAddressFields(value)).toEqual([]);
  });
});
