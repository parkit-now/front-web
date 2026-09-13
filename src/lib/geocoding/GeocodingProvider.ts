/**
 * Contrato de geocoding, agnóstico del proveedor.
 *
 * Existe para que cambiar Georef por otro backend (Nominatim, Google, HERE)
 * sea reemplazar UN archivo y no tocar el formulario: `AddressPicker` sólo
 * conoce este módulo. El resultado ya viene con los campos SEPARADOS que pide
 * `UpdateEntityAddressDto` del backend, así que el adapter de cada proveedor se
 * come la forma rara de su API y el resto del front ve siempre lo mismo.
 */

/**
 * Una dirección normalizada. Los nombres espejan `UpdateEntityAddressDto`
 * (backend) a propósito: `addressUtils.toUpdateAddressDto()` la copia campo a
 * campo sin renombrar nada.
 *
 * `streetNumber` es `string` y NO número: la numeración real de la Argentina
 * incluye `S/N`, `1234 bis` y `Km 5`. La columna en la base también es `text`.
 */
export interface GeocodedAddress {
  /** Dirección completa en una línea, para mostrar (la `nomenclatura` de Georef). */
  formatted: string;
  streetName: string | null;
  streetNumber: string | null;
  floor: string | null;
  cityName: string | null;
  stateName: string | null;
  postalCode: string | null;
  /**
   * Latitud/longitud en grados decimales, REDONDEADAS A 6 DECIMALES.
   *
   * No es cosmético: la columna es `numeric(9,6)` y el DTO valida
   * `@IsNumber({ maxDecimalPlaces: 6 })`. Georef devuelve 14 decimales, así que
   * mandar el valor crudo es un 400 garantizado.
   *
   * OJO: son una APROXIMACIÓN. Georef interpola sobre el segmento de calle, no
   * conoce el portal exacto. Por eso el formulario muestra un mapa con el pin
   * arrastrable: la persona corrige y eso pasa el origen a `manual`.
   */
  latitude: number | null;
  longitude: number | null;
}

/**
 * Por qué no alcanza con `GeocodedAddress[]`: "no encontré nada" y "el
 * proveedor está caído" llevan a mensajes distintos en la UI y a decisiones
 * distintas (con el proveedor caído el formulario ofrece la carga manual).
 *
 * - `ok`: hay al menos un candidato.
 * - `empty`: la consulta salió bien pero no hubo resultados.
 * - `unavailable`: red caída, timeout, 4xx/5xx o respuesta ilegible.
 * - `aborted`: la cancelamos nosotros porque llegó una búsqueda más nueva.
 */
export type GeocodingStatus = 'ok' | 'empty' | 'unavailable' | 'aborted';

export interface GeocodingResult {
  status: GeocodingStatus;
  results: GeocodedAddress[];
}

export interface GeocodingSearchOptions {
  /** Corta la request cuando el usuario dispara una búsqueda más nueva. */
  signal?: AbortSignal;
  /** Máximo de candidatos a pedir. El proveedor puede recortarlo. */
  limit?: number;
}

export interface GeocodingProvider {
  /** Identificador estable; es el valor que se guarda en `geocodingSource`. */
  readonly id: 'georef';
  /**
   * Busca candidatos para un texto libre.
   *
   * CONTRATO DURO: nunca rechaza ni lanza. Cualquier falla vuelve como
   * `{ status: 'unavailable', results: [] }`. El formulario de dirección no
   * puede quedar trabado porque una API pública del Estado se cayó.
   */
  search(
    query: string,
    options?: GeocodingSearchOptions,
  ): Promise<GeocodingResult>;
}

/** Resultado vacío reutilizable, para no repetir el literal en cada `catch`. */
export function geocodingFailure(
  status: Exclude<GeocodingStatus, 'ok'>,
): GeocodingResult {
  return { status, results: [] };
}
