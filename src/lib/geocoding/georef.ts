import {
  geocodingFailure,
  type GeocodedAddress,
  type GeocodingProvider,
  type GeocodingResult,
  type GeocodingSearchOptions,
} from './GeocodingProvider';

/**
 * Adapter de la API Georef del Estado argentino.
 *
 *   https://apis.datos.gob.ar/georef/api/direcciones?direccion=<texto>
 *
 * Gratis, sin API key y sin token. Devuelve `direcciones[]` con la calle, la
 * altura, la localidad censal, la provincia, la `nomenclatura` (la dirección
 * armada en una línea) y una `ubicacion` con lat/lon.
 */

const GEOREF_BASE_URL = 'https://apis.datos.gob.ar/georef/api/direcciones';
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

/**
 * Georef NO entiende la provincia dentro de `direccion`.
 *
 * Verificado contra la API real: `direccion=corrientes 1234 caba` devuelve 86
 * resultados de Santa Fe y en `parametros` se ve que parseó
 * `calles: ["corrientes"], altura: 1234` — la palabra "caba" la tiró a la
 * basura. Con `provincia=02` aparte devuelve UN resultado, el correcto.
 *
 * Por eso el texto libre se parte acá antes de salir a la red: si termina con
 * el nombre (o el apodo) de una jurisdicción, se manda como parámetro
 * `provincia`. Se usan los IDs del INDEC en vez del nombre porque "buenos
 * aires" es ambiguo entre la provincia y la Ciudad.
 */
const PROVINCE_IDS: Record<string, string> = {
  caba: '02',
  'c a b a': '02',
  'capital federal': '02',
  capital: '02',
  'ciudad de buenos aires': '02',
  'ciudad autonoma de buenos aires': '02',
  'buenos aires': '06',
  'provincia de buenos aires': '06',
  pba: '06',
  bsas: '06',
  gba: '06',
  catamarca: '10',
  cordoba: '14',
  corrientes: '18',
  chaco: '22',
  chubut: '26',
  'entre rios': '30',
  formosa: '34',
  jujuy: '38',
  'la pampa': '42',
  'la rioja': '46',
  mendoza: '50',
  misiones: '54',
  neuquen: '58',
  'rio negro': '62',
  salta: '66',
  'san juan': '70',
  'san luis': '74',
  'santa cruz': '78',
  'santa fe': '82',
  'santiago del estero': '86',
  tucuman: '90',
  'tierra del fuego': '94',
};

/** Alias ordenados de más largo a más corto: "capital federal" antes que "capital". */
const PROVINCE_ALIASES = Object.keys(PROVINCE_IDS).sort(
  (a, b) => b.length - a.length,
);

/** minúsculas, sin tildes, sin puntuación y con los espacios colapsados. */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface GeorefQuery {
  direccion: string;
  provincia?: string;
}

/**
 * Parte el texto libre en `direccion` + `provincia` (ver `PROVINCE_IDS`).
 *
 * Sólo separa cuando queda algo en `direccion`: "caba" sola se busca tal cual
 * en vez de convertirse en una consulta sin calle. Y el match es por SUFIJO,
 * así que "corrientes 1234" (la calle) no se confunde con la provincia
 * Corrientes, y "av santa fe 1234, santa fe" resuelve las dos cosas bien.
 */
export function splitGeorefQuery(raw: string): GeorefQuery {
  const normalized = normalizeText(raw);
  const direccion = raw.trim();
  if (!normalized) return { direccion };

  for (const alias of PROVINCE_ALIASES) {
    if (normalized === alias) break;
    if (!normalized.endsWith(` ${alias}`)) continue;

    const rest = normalized.slice(0, normalized.length - alias.length).trim();
    if (!rest) break;
    return { direccion: rest, provincia: PROVINCE_IDS[alias] };
  }

  return { direccion };
}

/**
 * Redondea a 6 decimales, que es lo que aguantan la columna `numeric(9,6)` y
 * el `@IsNumber({ maxDecimalPlaces: 6 })` del DTO. Georef contesta con 14.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Forma cruda de un item de `direcciones[]`. Se lee defensivamente. */
interface GeorefDireccion {
  altura?: { valor?: number | string | null; unidad?: string | null } | null;
  calle?: { nombre?: string | null } | null;
  piso?: string | null;
  provincia?: { nombre?: string | null } | null;
  localidad_censal?: { nombre?: string | null } | null;
  nomenclatura?: string | null;
  ubicacion?: { lat?: number | null; lon?: number | null } | null;
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? roundCoordinate(value)
    : null;
}

/**
 * Item de Georef → `GeocodedAddress`.
 *
 * Dos cosas que sorprenden de la API:
 *  - `altura.valor` viene como NÚMERO (1234) aunque la columna sea texto.
 *  - NO devuelve código postal en ningún campo. `postalCode` queda siempre en
 *    `null` y lo carga la persona a mano si lo necesita.
 */
export function mapGeorefDireccion(raw: GeorefDireccion): GeocodedAddress {
  const streetName = text(raw.calle?.nombre);
  const streetNumber = text(raw.altura?.valor);
  const cityName = text(raw.localidad_censal?.nombre);
  const stateName = text(raw.provincia?.nombre);

  // Sin `nomenclatura` se arma una línea equivalente, así el candidato siempre
  // tiene algo para mostrar en la lista.
  const formatted =
    text(raw.nomenclatura) ??
    [[streetName, streetNumber].filter(Boolean).join(' '), cityName, stateName]
      .filter((part) => part && part.length > 0)
      .join(', ');

  const latitude = coordinate(raw.ubicacion?.lat);
  const longitude = coordinate(raw.ubicacion?.lon);
  // Media coordenada la rechaza el CHECK `tenants_coordinates_paired`: o van
  // las dos o ninguna.
  const paired = latitude !== null && longitude !== null;

  return {
    formatted,
    streetName,
    streetNumber,
    floor: text(raw.piso),
    cityName,
    stateName,
    postalCode: null,
    latitude: paired ? latitude : null,
    longitude: paired ? longitude : null,
  };
}

export interface GeorefProviderOptions {
  baseUrl?: string;
  /** Inyectable para los tests; por defecto el `fetch` del browser. */
  fetchImpl?: typeof fetch;
}

export function buildGeorefUrl(
  query: string,
  limit: number,
  baseUrl: string = GEOREF_BASE_URL,
): string {
  const { direccion, provincia } = splitGeorefQuery(query);
  const params = new URLSearchParams({
    direccion,
    max: String(Math.min(Math.max(limit, 1), MAX_LIMIT)),
  });
  if (provincia) params.set('provincia', provincia);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Crea el provider. Nunca lanza: toda falla vuelve como `unavailable` para que
 * el formulario siga usable en modo manual (requisito del plan, no un extra).
 */
export function createGeorefProvider(
  options: GeorefProviderOptions = {},
): GeocodingProvider {
  const baseUrl = options.baseUrl ?? GEOREF_BASE_URL;

  return {
    id: 'georef',

    async search(
      query: string,
      searchOptions: GeocodingSearchOptions = {},
    ): Promise<GeocodingResult> {
      if (!query.trim()) return geocodingFailure('empty');

      // Se resuelve en cada llamada (y no en el closure) para que un test que
      // pisa `globalThis.fetch` no dependa del orden de importación.
      const doFetch = options.fetchImpl ?? globalThis.fetch;
      if (typeof doFetch !== 'function') return geocodingFailure('unavailable');

      const url = buildGeorefUrl(
        query,
        searchOptions.limit ?? DEFAULT_LIMIT,
        baseUrl,
      );

      let response: Response;
      try {
        response = await doFetch(url, {
          headers: { Accept: 'application/json' },
          signal: searchOptions.signal,
        });
      } catch (error) {
        // Una búsqueda cancelada NO es una caída: distinguirlas evita mostrar
        // "Georef no disponible" mientras la persona sigue tipeando.
        const aborted =
          searchOptions.signal?.aborted === true ||
          (error instanceof Error && error.name === 'AbortError');
        return geocodingFailure(aborted ? 'aborted' : 'unavailable');
      }

      // Georef contesta 400 con `{ errores: [...] }` cuando la consulta es
      // inválida (por ejemplo `direccion` vacía). Para el formulario es lo
      // mismo que estar caída: se ofrece la carga manual.
      if (!response.ok) return geocodingFailure('unavailable');

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return geocodingFailure('unavailable');
      }

      const direcciones = (body as { direcciones?: unknown } | null)
        ?.direcciones;
      if (!Array.isArray(direcciones)) return geocodingFailure('unavailable');
      if (direcciones.length === 0) return geocodingFailure('empty');

      const results = direcciones.map((item) =>
        mapGeorefDireccion((item ?? {}) as GeorefDireccion),
      );
      return { status: 'ok', results };
    },
  };
}

/** Instancia por defecto que usa la UI. */
export const georefProvider = createGeorefProvider();
