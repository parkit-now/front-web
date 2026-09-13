import type { components } from '../../../generated/api-types';
import type { GeocodedAddress } from '../../../lib/geocoding/GeocodingProvider';
import { roundCoordinate } from '../../../lib/geocoding/georef';

/**
 * Lógica pura del `AddressPicker`: mapeo Georef → DTO, normalización de los
 * campos de texto y la regla de `geocodingSource`.
 *
 * Vive separada del componente (y con tests colocalizados) por la misma razón
 * que `sections/tasas/validation.ts`: es la parte que se puede romper en
 * silencio, y probarla no necesita ni DOM ni red.
 */

export type EntityAddress = components['schemas']['EntityAddressDto'];
export type UpdateEntityAddress =
  components['schemas']['UpdateEntityAddressDto'];
export type GeocodingSource = NonNullable<EntityAddress['geocodingSource']>;

/** Campos que la persona escribe a mano. Todos strings: es el valor crudo del input. */
export const ADDRESS_TEXT_FIELDS = [
  'formatted',
  'streetName',
  'streetNumber',
  'floor',
  'cityName',
  'stateName',
  'postalCode',
] as const;

export type AddressTextField = (typeof ADDRESS_TEXT_FIELDS)[number];

/**
 * Estado del formulario de dirección.
 *
 * Los textos son strings (convención del repo: `useState` de strings crudos),
 * pero las coordenadas son `number | null` a propósito: NADIE las tipea. Salen
 * de Georef o de arrastrar el pin, y pasarlas por string sólo agregaría un
 * round-trip parse/format que se rompe con los separadores decimales.
 */
export interface AddressFormValue {
  formatted: string;
  streetName: string;
  streetNumber: string;
  floor: string;
  cityName: string;
  stateName: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  geocodingSource: GeocodingSource | null;
  geocodedAt: string | null;
}

export function emptyAddress(): AddressFormValue {
  return {
    formatted: '',
    streetName: '',
    streetNumber: '',
    floor: '',
    cityName: '',
    stateName: '',
    postalCode: '',
    latitude: null,
    longitude: null,
    geocodingSource: null,
    geocodedAt: null,
  };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function coord(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? roundCoordinate(value)
    : null;
}

function source(value: unknown): GeocodingSource | null {
  return value === 'georef' || value === 'manual' ? value : null;
}

/**
 * Perfil del backend → estado del formulario.
 *
 * TOLERANTE A PROPÓSITO con `location` ausente, `null` o a medio llenar: los
 * tenants anteriores a la migración `20260913164617` no tienen los campos
 * nuevos y NO hubo backfill. Si esto asumiera que `location` existe, abrir la
 * pestaña Perfil de un estacionamiento viejo sería una pantalla en blanco.
 *
 * `fallbackFormatted` es la columna `address` de toda la vida: cuando no hay
 * `location.formatted`, al menos se muestra la dirección vieja en una línea en
 * vez de perderla.
 */
export function addressFromLocation(
  location: Partial<EntityAddress> | null | undefined,
  fallbackFormatted?: string | null,
): AddressFormValue {
  const loc: Partial<EntityAddress> =
    location && typeof location === 'object' ? location : {};

  const latitude = coord(loc.latitude);
  const longitude = coord(loc.longitude);
  // Media coordenada no se muestra: la base la rechaza y dibujar un pin con
  // una sola componente es mentirle a la persona.
  const paired = latitude !== null && longitude !== null;

  return {
    formatted: str(loc.formatted) || str(fallbackFormatted),
    streetName: str(loc.streetName),
    streetNumber: str(loc.streetNumber),
    floor: str(loc.floor),
    cityName: str(loc.cityName),
    stateName: str(loc.stateName),
    postalCode: str(loc.postalCode),
    latitude: paired ? latitude : null,
    longitude: paired ? longitude : null,
    geocodingSource: source(loc.geocodingSource),
    geocodedAt: str(loc.geocodedAt) || null,
  };
}

/**
 * Candidato de Georef → estado del formulario. Origen `georef`.
 *
 * `postalCode` se PRESERVA del valor anterior: Georef no devuelve código
 * postal, así que pisarlo con vacío borraría lo que la persona ya había
 * escrito.
 */
export function addressFromGeocoded(
  geocoded: GeocodedAddress,
  previous: AddressFormValue = emptyAddress(),
  now: Date = new Date(),
): AddressFormValue {
  return {
    formatted: geocoded.formatted,
    streetName: str(geocoded.streetName),
    streetNumber: str(geocoded.streetNumber),
    floor: str(geocoded.floor) || previous.floor,
    cityName: str(geocoded.cityName),
    stateName: str(geocoded.stateName),
    postalCode: str(geocoded.postalCode) || previous.postalCode,
    latitude: coord(geocoded.latitude),
    longitude: coord(geocoded.longitude),
    geocodingSource: 'georef',
    geocodedAt: now.toISOString(),
  };
}

/**
 * Edición manual de un campo de texto.
 *
 * Si el valor cambia de verdad, el origen pasa a `manual`: la dirección ya no
 * es la que devolvió Georef y re-normalizarla automáticamente pisaría trabajo
 * humano. Un `onChange` que llega con el mismo texto (re-render, foco) NO
 * ensucia el origen.
 */
export function setAddressField(
  value: AddressFormValue,
  field: AddressTextField,
  text: string,
  now: Date = new Date(),
): AddressFormValue {
  if (value[field] === text) return value;
  return {
    ...value,
    [field]: text,
    geocodingSource: 'manual',
    geocodedAt: now.toISOString(),
  };
}

/**
 * Los campos del detalle que SÍ hacen falta para que la dirección sirva,
 * VENGA DE DONDE VENGA.
 *
 * Se llamaban `REQUIRED_MANUAL_FIELDS` y sólo se miraban en la carga a mano:
 * con `geocodingSource === 'georef'` el formulario no chequeaba nada. Eso
 * dejaba pasar una respuesta a medias de Georef (una calle sin altura, un
 * match a nivel localidad) por un camino que a una persona le habría
 * rechazado. El nombre mentía y la validación seguía al nombre.
 *
 * No es una lista arbitraria: son exactamente los que Mercado Pago pide para
 * la ubicación del `Store` (`street_name`, `street_number`, `city_name`,
 * `state_name`), y MP no pregunta quién los escribió. Quedan AFUERA a
 * propósito:
 *
 *  - `floor`: el propio DTO del backend lo documenta como "sólo para
 *    contacto/facturación; Mercado Pago no lo usa".
 *  - `postalCode`: Georef NO lo devuelve. Exigirlo a mano haría que la carga
 *    manual sea MÁS estricta que el camino feliz — un formulario que rechaza
 *    lo que su propio autocompletado produce.
 *  - `latitude`/`longitude`: nadie las tipea. Sin Georef no hay coordenadas, y
 *    obligar a arrastrar el pin sería frenar un alta por una API del Estado
 *    caída, que es justo lo que no se puede hacer.
 */
export const REQUIRED_ADDRESS_FIELDS = [
  'streetName',
  'streetNumber',
  'cityName',
  'stateName',
] as const satisfies readonly AddressTextField[];

/**
 * Clave de comparación de una parte de la dirección: sólo letras y dígitos,
 * sin tildes y en minúsculas.
 *
 * Se tiran TAMBIÉN los espacios y los puntos, no sólo las tildes: "C.A.B.A.",
 * "CABA" y "C A B A" son el mismo lugar para una persona, y esta comparación
 * existe para decidir si hace falta escribirlo dos veces. Pasarse de agresivo
 * acá sólo puede unificar dos nombres que se escriben casi igual — comparando
 * localidad contra provincia, eso es exactamente lo que se busca.
 */
function labelKey(part: string): string {
  return part
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Arma la línea de display a partir de los campos separados, con la misma
 * forma que la `nomenclatura` de Georef ("Calle Altura, Localidad, Provincia").
 *
 * Existe porque el formulario dejó de pedir la línea de una sola línea: era
 * redundante con el detalle y cada campo extra es un campo donde equivocarse.
 * Cuando la persona carga a mano, la línea se DEDUCE.
 *
 * ⚠️ DEDUPLICA las partes repetidas, y el caso no es teórico: es CABA. Georef
 * devuelve, para una dirección porteña, `localidad_censal` Y `provincia` con
 * el MISMO texto ("Ciudad Autónoma de Buenos Aires") — su `nomenclatura` no lo
 * nota porque usa otra nomenclatura ("…, Comuna 13, CABA"). Concatenar los
 * campos sin mirar producía:
 *
 *   AV CABILDO 2000, Ciudad Autónoma de Buenos Aires, Ciudad Autónoma de Buenos Aires
 *
 * La comparación es por `labelKey` (sin tildes ni puntuación) y NO sólo entre
 * localidad y provincia: cualquier parte repetida se escribe una sola vez.
 */
export function composeFormatted(value: AddressFormValue): string {
  const street = [value.streetName.trim(), value.streetNumber.trim()]
    .filter(Boolean)
    .join(' ');

  const seen = new Set<string>();
  return [street, value.cityName.trim(), value.stateName.trim()]
    .filter(Boolean)
    .filter((part) => {
      const key = labelKey(part);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

/**
 * Los campos que REALMENTE aparecen en la línea de display.
 *
 * El piso y el código postal no entran (ver `addressSummaryDetail`), así que
 * tocarlos no tiene por qué recomponer nada: recomponer ahí sólo servía para
 * tirar a la basura la `nomenclatura` de Georef —que es más legible que
 * cualquier cosa que armemos nosotros— a cambio de nada.
 */
const FORMATTED_FIELDS: readonly AddressTextField[] = [
  'streetName',
  'streetNumber',
  'cityName',
  'stateName',
];

/**
 * Edición manual de un campo del DETALLE (calle, altura, piso, localidad,
 * provincia, CP).
 *
 * Hace lo mismo que `setAddressField` —marcar el origen como `manual`— y
 * además RECOMPONE `formatted`. Sin esto, corregir la localidad a mano dejaría
 * la línea de display con el texto viejo de Georef: la pantalla mostraría una
 * dirección y la base guardaría otra.
 *
 * Pero recompone SÓLO si el campo tocado sale en la línea. Cambiar el piso o
 * el código postal no cambia la dirección que se muestra, y recomponer igual
 * tiraba la `nomenclatura` de Georef ("…, Comuna 13, CABA") para reemplazarla
 * por nuestra versión — peor y sin motivo.
 */
export function setAddressDetailField(
  value: AddressFormValue,
  field: AddressTextField,
  text: string,
  now: Date = new Date(),
): AddressFormValue {
  const next = setAddressField(value, field, text, now);
  // `setAddressField` devuelve el MISMO objeto cuando el texto no cambió: ahí
  // no hay nada que recomponer ni origen que ensuciar.
  if (next === value) return value;
  if (!FORMATTED_FIELDS.includes(field)) return next;
  return { ...next, formatted: composeFormatted(next) };
}

/** `true` cuando la dirección la normalizó Georef y tiene línea de display. */
export function isGeorefNormalized(value: AddressFormValue): boolean {
  return (
    value.geocodingSource === 'georef' && value.formatted.trim().length > 0
  );
}

/**
 * Cuáles de los campos obligatorios están vacíos. Se aplica al camino de
 * Georef igual que al manual: ver `REQUIRED_ADDRESS_FIELDS`.
 *
 * Devuelve la lista (y no un booleano) para que el mensaje de error pueda
 * nombrar lo que falta en vez de decir "completá la dirección" y dejar a la
 * persona buscando cuál de seis campos es.
 */
export function missingAddressFields(
  value: AddressFormValue,
): AddressTextField[] {
  return REQUIRED_ADDRESS_FIELDS.filter(
    (field) => value[field].trim().length === 0,
  );
}

/**
 * Línea principal del resumen que se muestra DEBAJO del mapa: la de display, o
 * la calle con su altura si todavía no hay ninguna.
 */
export function addressPrimaryLine(value: AddressFormValue): string {
  const formatted = value.formatted.trim();
  if (formatted) return formatted;
  return [value.streetName.trim(), value.streetNumber.trim()]
    .filter(Boolean)
    .join(' ');
}

/**
 * Línea secundaria del resumen: lo que la línea de display NO dice.
 *
 * `cityName`/`stateName` sólo aparecen cuando no hay línea de display, porque
 * la `nomenclatura` de Georef ya las trae adentro y repetirlas es ruido. El
 * piso y el código postal siempre pueden ir: Georef no los devuelve, así que
 * nunca están en `formatted`.
 */
export function addressSummaryDetail(value: AddressFormValue): string {
  const parts: string[] = [];
  if (!value.formatted.trim()) {
    parts.push(value.cityName.trim(), value.stateName.trim());
  }
  const floor = value.floor.trim();
  if (floor) parts.push(`Piso ${floor}`);
  const postalCode = value.postalCode.trim();
  if (postalCode) parts.push(`CP ${postalCode}`);
  return parts.filter(Boolean).join(' · ');
}

/**
 * Pin arrastrado en el mapa → origen `manual`, SIEMPRE.
 *
 * Este es el paso que justifica que exista el mapa: las coordenadas de Georef
 * son una interpolación sobre el segmento de calle, no el portal. Si alguien
 * la corrigió a mano, volver a geocodificar y pisarla sería tirar el único
 * dato bueno que hay.
 */
export function moveAddressPin(
  value: AddressFormValue,
  latitude: number,
  longitude: number,
  now: Date = new Date(),
): AddressFormValue {
  return {
    ...value,
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    geocodingSource: 'manual',
    geocodedAt: now.toISOString(),
  };
}

export function hasCoordinates(
  value: AddressFormValue,
): value is AddressFormValue & { latitude: number; longitude: number } {
  return value.latitude !== null && value.longitude !== null;
}

/** `true` cuando no hay NADA cargado: ni texto ni coordenadas. */
export function isAddressEmpty(value: AddressFormValue): boolean {
  const noText = ADDRESS_TEXT_FIELDS.every(
    (field) => value[field].trim().length === 0,
  );
  return noText && !hasCoordinates(value);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Estado del formulario → `UpdateEntityAddressDto`.
 *
 * Manda TODAS las claves (con `null` explícito cuando el campo quedó vacío)
 * porque el formulario muestra la dirección completa: si omitiera las vacías,
 * borrar un campo en pantalla no lo borraría en la base, y la próxima lectura
 * lo traería de vuelta.
 *
 * Reglas que NO son negociables (las impone el backend):
 *  - El par lat/lng va completo o no va: el CHECK `tenants_coordinates_paired`
 *    rechaza media coordenada, y el DTO devuelve 400 antes.
 *  - Las coordenadas van redondeadas a 6 decimales (`@IsNumber({ maxDecimalPlaces: 6 })`).
 *  - `formatted` GANA sobre el `address` plano, así que el llamador puede
 *    dejar de mandar `address`.
 */
export function toUpdateAddressDto(
  value: AddressFormValue,
): UpdateEntityAddress {
  const paired = hasCoordinates(value);
  const empty = isAddressEmpty(value);

  return {
    formatted: nullable(value.formatted),
    streetName: nullable(value.streetName),
    streetNumber: nullable(value.streetNumber),
    floor: nullable(value.floor),
    cityName: nullable(value.cityName),
    stateName: nullable(value.stateName),
    postalCode: nullable(value.postalCode),
    latitude: paired ? roundCoordinate(value.latitude) : null,
    longitude: paired ? roundCoordinate(value.longitude) : null,
    // Sin ningún dato cargado no hay origen que declarar: dejar un `georef`
    // colgado sobre una dirección borrada es basura para el próximo que lea.
    geocodingSource: empty ? null : value.geocodingSource,
    geocodedAt: empty ? null : value.geocodedAt,
  };
}

/**
 * Igual que `toUpdateAddressDto` pero para el alta de la solicitud de
 * onboarding: si no se cargó NADA, devuelve `undefined` para omitir `location`
 * del payload. Los campos son opcionales — una solicitud sin dirección tiene
 * que poder crearse igual.
 */
export function toDeclaredLocation(
  value: AddressFormValue,
): UpdateEntityAddress | undefined {
  return isAddressEmpty(value) ? undefined : toUpdateAddressDto(value);
}

/** Etiqueta corta para mostrar el origen del dato. */
export function describeGeocodingSource(
  source: GeocodingSource | null,
): string | null {
  if (source === 'georef') return 'Normalizada con Georef';
  if (source === 'manual') return 'Cargada manualmente';
  return null;
}
