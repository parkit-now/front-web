import { describe, expect, it, vi } from 'vitest';
import {
  buildGeorefUrl,
  createGeorefProvider,
  mapGeorefDireccion,
  roundCoordinate,
  splitGeorefQuery,
} from './georef';

/** Item real de `direcciones[]`, copiado de una respuesta de la API. */
const AV_CORRIENTES_1234 = {
  altura: { unidad: null, valor: 1234 },
  calle: { categoria: 'AV', id: '0200701001185', nombre: 'AV CORRIENTES' },
  departamento: { id: '02007', nombre: 'Comuna 1' },
  localidad_censal: {
    id: '02000010',
    nombre: 'Ciudad Autónoma de Buenos Aires',
  },
  nomenclatura: 'AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires',
  piso: null,
  provincia: { id: '02', nombre: 'Ciudad Autónoma de Buenos Aires' },
  ubicacion: { lat: -34.60385632930893, lon: -58.38419018127011 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function providerWith(fetchImpl: typeof fetch) {
  return createGeorefProvider({
    baseUrl: 'https://georef.test/direcciones',
    fetchImpl,
  });
}

describe('splitGeorefQuery', () => {
  it('saca la provincia del texto libre: Georef la ignora si va en `direccion`', () => {
    expect(splitGeorefQuery('corrientes 1234 caba')).toEqual({
      direccion: 'corrientes 1234',
      provincia: '02',
    });
  });

  it('tolera la coma y los acentos', () => {
    expect(splitGeorefQuery('Av. Córdoba 5000, Capital Federal')).toEqual({
      direccion: 'av cordoba 5000',
      provincia: '02',
    });
  });

  it('prefiere el alias más largo: "capital federal" antes que "capital"', () => {
    expect(splitGeorefQuery('mitre 100 capital federal').provincia).toBe('02');
    expect(splitGeorefQuery('mitre 100 capital').provincia).toBe('02');
  });

  it('no confunde la CALLE Corrientes con la PROVINCIA Corrientes', () => {
    expect(splitGeorefQuery('corrientes 1234')).toEqual({
      direccion: 'corrientes 1234',
    });
  });

  it('resuelve calle y provincia con el mismo nombre', () => {
    expect(splitGeorefQuery('av santa fe 1234 santa fe')).toEqual({
      direccion: 'av santa fe 1234',
      provincia: '82',
    });
  });

  it('no deja la dirección vacía cuando el texto es sólo la provincia', () => {
    expect(splitGeorefQuery('caba')).toEqual({ direccion: 'caba' });
  });

  it('devuelve el texto tal cual cuando no hay provincia reconocible', () => {
    expect(splitGeorefQuery('  Bartolomé Mitre 2500  ')).toEqual({
      direccion: 'Bartolomé Mitre 2500',
    });
  });
});

describe('buildGeorefUrl', () => {
  it('manda `direccion` + `provincia` + `max`', () => {
    const url = new URL(
      buildGeorefUrl('corrientes 1234 caba', 5, 'https://georef.test/d'),
    );
    expect(url.searchParams.get('direccion')).toBe('corrientes 1234');
    expect(url.searchParams.get('provincia')).toBe('02');
    expect(url.searchParams.get('max')).toBe('5');
  });

  it('omite `provincia` cuando no se pudo inferir', () => {
    const url = new URL(
      buildGeorefUrl('mitre 2500', 8, 'https://georef.test/d'),
    );
    expect(url.searchParams.has('provincia')).toBe(false);
  });

  it('recorta el límite a un rango sano', () => {
    const big = new URL(buildGeorefUrl('mitre 2500', 999, 'https://g.test/d'));
    expect(big.searchParams.get('max')).toBe('20');
    const small = new URL(buildGeorefUrl('mitre 2500', 0, 'https://g.test/d'));
    expect(small.searchParams.get('max')).toBe('1');
  });
});

describe('roundCoordinate', () => {
  it('recorta a 6 decimales: la columna es numeric(9,6) y el DTO valida igual', () => {
    expect(roundCoordinate(-34.60385632930893)).toBe(-34.603856);
    expect(roundCoordinate(-58.38419018127011)).toBe(-58.38419);
  });
});

describe('mapGeorefDireccion', () => {
  it('mapea la respuesta a la forma del DTO', () => {
    expect(mapGeorefDireccion(AV_CORRIENTES_1234)).toEqual({
      formatted:
        'AV CORRIENTES 1234, Comuna 1, Ciudad Autónoma de Buenos Aires',
      streetName: 'AV CORRIENTES',
      // Georef manda la altura como NÚMERO; la columna y el DTO la quieren texto.
      streetNumber: '1234',
      floor: null,
      cityName: 'Ciudad Autónoma de Buenos Aires',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      // Georef no devuelve código postal en ningún campo.
      postalCode: null,
      latitude: -34.603856,
      longitude: -58.38419,
    });
  });

  it('arma una línea cuando falta `nomenclatura`', () => {
    const mapped = mapGeorefDireccion({
      ...AV_CORRIENTES_1234,
      nomenclatura: null,
    });
    expect(mapped.formatted).toBe(
      'AV CORRIENTES 1234, Ciudad Autónoma de Buenos Aires, Ciudad Autónoma de Buenos Aires',
    );
  });

  it('descarta media coordenada: el CHECK de la base la rechaza', () => {
    const mapped = mapGeorefDireccion({
      ...AV_CORRIENTES_1234,
      ubicacion: { lat: -34.6, lon: null },
    });
    expect(mapped.latitude).toBeNull();
    expect(mapped.longitude).toBeNull();
  });

  it('no explota con un item vacío', () => {
    expect(() => mapGeorefDireccion({})).not.toThrow();
    expect(mapGeorefDireccion({}).streetName).toBeNull();
  });
});

describe('georefProvider.search', () => {
  it('respuesta normal: devuelve los candidatos mapeados', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ cantidad: 1, direcciones: [AV_CORRIENTES_1234] }),
      );
    const result = await providerWith(fetchImpl as never).search(
      'corrientes 1234 caba',
    );

    expect(result.status).toBe('ok');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].streetName).toBe('AV CORRIENTES');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('varios resultados (consulta ambigua): los devuelve todos para que elija la persona', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        cantidad: 3,
        direcciones: [
          {
            ...AV_CORRIENTES_1234,
            nomenclatura: 'CORRIENTES 1234, Castellanos, Santa Fe',
          },
          {
            ...AV_CORRIENTES_1234,
            nomenclatura: 'CORRIENTES 1234, San Jerónimo, Santa Fe',
          },
          {
            ...AV_CORRIENTES_1234,
            nomenclatura: 'CORRIENTES 1234, Iriondo, Santa Fe',
          },
        ],
      }),
    );
    const result = await providerWith(fetchImpl as never).search(
      'corrientes 1234',
    );

    expect(result.status).toBe('ok');
    expect(result.results.map((r) => r.formatted)).toEqual([
      'CORRIENTES 1234, Castellanos, Santa Fe',
      'CORRIENTES 1234, San Jerónimo, Santa Fe',
      'CORRIENTES 1234, Iriondo, Santa Fe',
    ]);
  });

  it('cero resultados: `empty`, sin lanzar', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ cantidad: 0, direcciones: [] }));
    const result = await providerWith(fetchImpl as never).search('zzzz 9999');

    expect(result).toEqual({ status: 'empty', results: [] });
  });

  it('consulta vacía: ni sale a la red', async () => {
    const fetchImpl = vi.fn();
    const result = await providerWith(fetchImpl as never).search('   ');

    expect(result).toEqual({ status: 'empty', results: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('error de red: `unavailable`, NUNCA una excepción que rompa el formulario', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    const provider = providerWith(fetchImpl as never);

    await expect(provider.search('corrientes 1234')).resolves.toEqual({
      status: 'unavailable',
      results: [],
    });
  });

  it('HTTP 500: `unavailable`', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    const result = await providerWith(fetchImpl as never).search('mitre 2500');

    expect(result).toEqual({ status: 'unavailable', results: [] });
  });

  it('HTTP 400 (el que devuelve Georef ante una consulta inválida): `unavailable`', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          errores: [
            { codigo_interno: 1001, mensaje: 'El campo no tiene contenido.' },
          ],
        },
        400,
      ),
    );
    const result = await providerWith(fetchImpl as never).search('mitre 2500');

    expect(result).toEqual({ status: 'unavailable', results: [] });
  });

  it('JSON ilegible: `unavailable`', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    });
    const result = await providerWith(fetchImpl as never).search('mitre 2500');

    expect(result).toEqual({ status: 'unavailable', results: [] });
  });

  it('respuesta 200 con una forma inesperada: `unavailable`', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ resultados: 'otra cosa' }));
    const result = await providerWith(fetchImpl as never).search('mitre 2500');

    expect(result).toEqual({ status: 'unavailable', results: [] });
  });

  it('búsqueda cancelada: `aborted`, para no mostrar "no disponible" al tipear', async () => {
    const controller = new AbortController();
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(abortError);

    controller.abort();
    const result = await providerWith(fetchImpl as never).search('mitre 2500', {
      signal: controller.signal,
    });

    expect(result).toEqual({ status: 'aborted', results: [] });
  });

  it('sin `fetch` en el entorno: `unavailable` en vez de reventar', async () => {
    const provider = createGeorefProvider({
      fetchImpl: undefined as unknown as typeof fetch,
    });
    const original = globalThis.fetch;
    // @ts-expect-error se prueba a propósito un entorno sin fetch.
    delete globalThis.fetch;
    try {
      await expect(provider.search('mitre 2500')).resolves.toEqual({
        status: 'unavailable',
        results: [],
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});
