import { describe, expect, it } from 'vitest';
import { AR_LOCATION_CATALOG } from './arCatalog';
import {
  AR_PROVINCES,
  citiesOf,
  findCity,
  findProvince,
  isCityInProvince,
  matchCity,
  matchProvince,
  normalizeLocationName,
  resolveGeocodedLocation,
} from './catalog';

/**
 * Los nombres de provincia EXACTOS que devuelve Georef en `provincia.nombre`.
 *
 * Copiados de una llamada real a `https://apis.datos.gob.ar/georef/api/provincias`.
 * Son los del INDEC y NO son los de MercadoLibre: dos difieren (CABA y Tierra
 * del Fuego). Este array es el que le da sentido al test de abajo — es la
 * lista que, si alguien toca los alias, deja de resolver.
 */
const GEOREF_PROVINCES = [
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Ciudad Autónoma de Buenos Aires',
  'Corrientes',
  'Córdoba',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
  'Tucumán',
];

describe('normalizeLocationName', () => {
  it('saca las tildes y pasa a minúsculas', () => {
    expect(normalizeLocationName('Martínez')).toBe('martinez');
    expect(normalizeLocationName('CÓRDOBA')).toBe('cordoba');
  });

  it('colapsa los espacios de más', () => {
    expect(normalizeLocationName('  San   Isidro ')).toBe('san isidro');
  });

  it('CONSERVA los espacios entre palabras', () => {
    // No es un detalle: si los tirara, "Villa María" y "Villamaría" serían la
    // misma clave y elegiríamos la localidad equivocada sin avisar.
    expect(normalizeLocationName('Villa María')).not.toBe(
      normalizeLocationName('Villamaría'),
    );
  });
});

describe('el catálogo embebido', () => {
  it('tiene las 24 provincias con ciudades', () => {
    expect(AR_PROVINCES).toHaveLength(24);
    for (const province of AR_PROVINCES) {
      expect(citiesOf(province).length).toBeGreaterThan(0);
    }
  });

  it('no tiene ciudades duplicadas dentro de una provincia', () => {
    for (const province of AR_PROVINCES) {
      const keys = citiesOf(province).map(normalizeLocationName);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('está ordenado alfabéticamente en español', () => {
    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    const sorted = [...AR_PROVINCES].sort((a, b) => collator.compare(a, b));
    expect(AR_PROVINCES).toEqual(sorted);
  });
});

describe('findProvince', () => {
  it('encuentra la provincia sin importar tildes ni mayúsculas', () => {
    expect(findProvince('cordoba')).toBe('Córdoba');
    expect(findProvince('ENTRE RIOS')).toBe('Entre Ríos');
  });

  it('devuelve el string EXACTO del catálogo, con sus tildes', () => {
    // Lo que se guarda es esto, no lo que escribió la persona: MP compara
    // contra su propio string.
    expect(findProvince('rio negro')).toBe('Río Negro');
  });

  it('traduce el nombre que usa Georef para CABA', () => {
    expect(findProvince('Ciudad Autónoma de Buenos Aires')).toBe(
      'Capital Federal',
    );
  });

  it('traduce el nombre largo de Tierra del Fuego', () => {
    expect(
      findProvince('Tierra del Fuego, Antártida e Islas del Atlántico Sur'),
    ).toBe('Tierra del Fuego');
  });

  it('devuelve null para lo que no existe', () => {
    expect(findProvince('Bs. As.')).toBeNull();
    expect(findProvince('')).toBeNull();
  });

  it('resuelve las 24 provincias que devuelve Georef', () => {
    // EL test de este ticket. Georef y MercadoLibre le ponen distinto nombre a
    // la misma provincia en dos casos; si alguien toca los alias, acá se cae.
    const sinResolver = GEOREF_PROVINCES.filter(
      (name) => findProvince(name) === null,
    );
    expect(sinResolver).toEqual([]);
  });

  it('cada alias cae en una provincia real del catálogo', () => {
    for (const name of GEOREF_PROVINCES) {
      expect(AR_LOCATION_CATALOG[findProvince(name)!]).toBeDefined();
    }
  });
});

describe('findCity', () => {
  it('encuentra la ciudad dentro de su provincia', () => {
    expect(findCity('Buenos Aires', 'san isidro')).toBe('San Isidro');
  });

  it('acepta la provincia escrita como la manda Georef', () => {
    expect(findCity('Ciudad Autónoma de Buenos Aires', 'palermo')).toBe(
      'Palermo',
    );
  });

  it('devuelve null si la ciudad no está en ESA provincia', () => {
    // Rosario existe, pero no en Mendoza. Buscar suelto entre las 1.046 daría
    // un falso positivo y guardaría un par imposible.
    expect(findCity('Mendoza', 'Rosario')).toBeNull();
    expect(findCity('Santa Fe', 'Rosario')).toBe('Rosario');
  });

  it('devuelve null si la provincia no existe', () => {
    expect(findCity('Bs. As.', 'San Isidro')).toBeNull();
  });

  it('no conoce "Martínez" — el bug que rechazaba Mercado Pago', () => {
    expect(findCity('Buenos Aires', 'Martínez')).toBeNull();
    // Lo que MP sí conoce de esa zona, y con lo que la vinculación funcionó.
    expect(findCity('Buenos Aires', 'San Isidro')).toBe('San Isidro');
    expect(findCity('Buenos Aires', 'Beccar')).toBe('Beccar');
  });
});

describe('isCityInProvince', () => {
  it('es true sólo cuando la ciudad pertenece a la provincia', () => {
    expect(isCityInProvince('Buenos Aires', 'La Plata')).toBe(true);
    expect(isCityInProvince('Córdoba', 'La Plata')).toBe(false);
  });

  it('es false con la ciudad vacía', () => {
    expect(isCityInProvince('Buenos Aires', '')).toBe(false);
  });
});

describe('matchProvince', () => {
  it('distingue vacío de desconocido', () => {
    expect(matchProvince('   ')).toEqual({ status: 'empty' });
    expect(matchProvince('Bs. As.')).toEqual({
      status: 'unknown',
      value: 'Bs. As.',
    });
  });

  it('devuelve el valor normalizado del catálogo cuando matchea', () => {
    expect(matchProvince('capital federal')).toEqual({
      status: 'matched',
      value: 'Capital Federal',
    });
  });
});

describe('matchCity', () => {
  it('marca como desconocida la ciudad que MP no tiene', () => {
    expect(matchCity('Buenos Aires', 'Martínez')).toEqual({
      status: 'unknown',
      value: 'Martínez',
    });
  });

  it('marca como desconocida la ciudad si la provincia no se reconoce', () => {
    expect(matchCity('Bs. As.', 'San Isidro')).toEqual({
      status: 'unknown',
      value: 'San Isidro',
    });
  });
});

describe('resolveGeocodedLocation', () => {
  it('resuelve las dos cosas cuando Georef coincide con el catálogo', () => {
    expect(resolveGeocodedLocation('Buenos Aires', 'San Isidro')).toEqual({
      province: { status: 'matched', value: 'Buenos Aires' },
      city: { status: 'matched', value: 'San Isidro' },
    });
  });

  it('resuelve la provincia y deja la ciudad en unknown — el caso "Martínez"', () => {
    expect(resolveGeocodedLocation('Buenos Aires', 'Martínez')).toEqual({
      province: { status: 'matched', value: 'Buenos Aires' },
      city: { status: 'unknown', value: 'Martínez' },
    });
  });

  it('en CABA resuelve la provincia pero no la localidad censal', () => {
    // Georef manda la ciudad entera como localidad; para MP las "ciudades" de
    // Capital Federal son los 60 barrios. El barrio lo elige la persona.
    expect(
      resolveGeocodedLocation(
        'Ciudad Autónoma de Buenos Aires',
        'Ciudad Autónoma de Buenos Aires',
      ),
    ).toEqual({
      province: { status: 'matched', value: 'Capital Federal' },
      city: {
        status: 'unknown',
        value: 'Ciudad Autónoma de Buenos Aires',
      },
    });
  });

  it('con una provincia desconocida no valida la ciudad ni de casualidad', () => {
    expect(resolveGeocodedLocation('Bs. As.', 'San Isidro')).toEqual({
      province: { status: 'unknown', value: 'Bs. As.' },
      city: { status: 'unknown', value: 'San Isidro' },
    });
  });

  it('deja ambos en empty cuando Georef no devolvió nada', () => {
    expect(resolveGeocodedLocation('', '')).toEqual({
      province: { status: 'empty' },
      city: { status: 'empty' },
    });
  });
});
