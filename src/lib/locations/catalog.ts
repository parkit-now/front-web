import { AR_LOCATION_CATALOG } from './arCatalog';

/**
 * Lookup sobre el catálogo de Mercado Libre / Mercado Pago (`arCatalog.ts`).
 *
 * Vive acá, puro y sin JSX, por la misma razón que `addressUtils.ts`: es la
 * parte que se rompe en silencio. Un match que falla no tira ningún error —
 * deja pasar un `city_name` que Mercado Pago va a rechazar recién cuando el
 * dueño intente vincular su cuenta, en producción, dos pantallas después.
 *
 * REGLA DE ORO, y no es negociable: acá se COMPARA sin tildes ni mayúsculas,
 * pero se DEVUELVE siempre el string EXACTO del catálogo. Guardar "San isidro"
 * porque así lo escribió alguien es guardar un valor que MP no conoce.
 */

/**
 * Clave de comparación: minúsculas, sin tildes y con los espacios colapsados.
 *
 * A diferencia del `labelKey` de `addressUtils` —que además tira espacios y
 * puntuación para decidir si dos partes de la dirección son la MISMA— acá los
 * espacios se CONSERVAN. Esa comparación existe para deduplicar un display;
 * esta decide qué se guarda en la base. Ser agresivo allá une "CABA" con
 * "C.A.B.A."; ser agresivo acá uniría "Villa María" con "Villamaría", que son
 * dos localidades distintas, y elegiríamos la equivocada sin avisar.
 */
export function normalizeLocationName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombres de provincia que existen fuera del catálogo y significan lo mismo.
 *
 * ⚠️ Esto NO es fuzzy matching y NO se extiende a las ciudades. Son las dos
 * ÚNICAS jurisdicciones donde Georef (INDEC) y MELI le ponen distinto nombre a
 * la misma provincia — verificado llamando a las dos APIs: las otras 22
 * coinciden carácter por carácter.
 *
 *   Georef: "Ciudad Autónoma de Buenos Aires"  ·  MELI: "Capital Federal"
 *   Georef: "Tierra del Fuego, Antártida e     ·  MELI: "Tierra del Fuego"
 *            Islas del Atlántico Sur"
 *
 * Sin esta tabla, TODA dirección porteña —el caso más común del producto—
 * quedaría sin provincia preseleccionada. Y es seguro justamente porque las
 * provincias son un conjunto CERRADO de 24: el test verifica que cada alias
 * caiga en una provincia real y que las 24 de Georef resuelvan.
 *
 * Las ciudades NO tienen tabla equivalente a propósito: son 1.046, abiertas, y
 * adivinar ahí es exactamente el bug que estamos arreglando.
 */
const PROVINCE_ALIASES: Readonly<Record<string, string>> = {
  [normalizeLocationName('Ciudad Autónoma de Buenos Aires')]: 'Capital Federal',
  [normalizeLocationName('Ciudad de Buenos Aires')]: 'Capital Federal',
  [normalizeLocationName('CABA')]: 'Capital Federal',
  [normalizeLocationName(
    'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
  )]: 'Tierra del Fuego',
};

/** Índice normalizado → string exacto, armado una sola vez al importar. */
const PROVINCE_INDEX: ReadonlyMap<string, string> = new Map(
  Object.keys(AR_LOCATION_CATALOG).map((name) => [
    normalizeLocationName(name),
    name,
  ]),
);

const CITY_INDEX: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(
  Object.entries(AR_LOCATION_CATALOG).map(([province, cities]) => [
    province,
    new Map(cities.map((city) => [normalizeLocationName(city), city])),
  ]),
);

/** Las 24 provincias, en orden alfabético español. */
export const AR_PROVINCES: readonly string[] = Object.keys(AR_LOCATION_CATALOG);

/**
 * Resultado de buscar un valor en el catálogo.
 *
 * `unknown` no es un error: es el caso de compatibilidad hacia atrás. Hay
 * tenants guardados con "Martínez" y ese dato NO se borra — se muestra marcado
 * para que la persona lo corrija. Un booleano no alcanzaría porque hay que
 * distinguir "no hay nada cargado" de "hay algo cargado que MP no conoce".
 */
export type CatalogMatch =
  | { status: 'empty' }
  | { status: 'matched'; value: string }
  | { status: 'unknown'; value: string };

const EMPTY_MATCH: CatalogMatch = { status: 'empty' };

/** Las ciudades de una provincia. `[]` si la provincia no está en el catálogo. */
export function citiesOf(province: string): readonly string[] {
  const exact = findProvince(province);
  return exact === null ? [] : AR_LOCATION_CATALOG[exact];
}

/**
 * Provincia del catálogo que corresponde a `value`, o `null`.
 *
 * Tolerante a mayúsculas, tildes y a los dos alias de arriba. Devuelve el
 * string EXACTO del catálogo.
 */
export function findProvince(value: string): string | null {
  const key = normalizeLocationName(value);
  if (!key) return null;
  const aliased = PROVINCE_ALIASES[key];
  if (aliased) return aliased;
  return PROVINCE_INDEX.get(key) ?? null;
}

/**
 * Ciudad del catálogo DENTRO de `province`, o `null`.
 *
 * Se busca siempre acotado a la provincia, nunca en las 1.046 sueltas: hay
 * homónimas en provincias distintas y elegir la primera que aparezca sería
 * inventar. Sin provincia válida no hay búsqueda posible — y ese es el motivo
 * técnico, además del de UX, por el que el selector de ciudad arranca
 * deshabilitado.
 */
export function findCity(province: string, value: string): string | null {
  const exactProvince = findProvince(province);
  if (exactProvince === null) return null;
  const key = normalizeLocationName(value);
  if (!key) return null;
  return CITY_INDEX.get(exactProvince)?.get(key) ?? null;
}

/** `true` si la ciudad pertenece a la provincia. La regla del selector encadenado. */
export function isCityInProvince(province: string, city: string): boolean {
  return findCity(province, city) !== null;
}

/** Clasifica un valor de provincia: vacío, reconocido o desconocido. */
export function matchProvince(value: string): CatalogMatch {
  const raw = value.trim();
  if (!raw) return EMPTY_MATCH;
  const exact = findProvince(raw);
  return exact === null
    ? { status: 'unknown', value: raw }
    : { status: 'matched', value: exact };
}

/**
 * Clasifica un valor de ciudad dentro de una provincia.
 *
 * Si la provincia no es reconocida, una ciudad cargada vuelve `unknown` aunque
 * exista en otra provincia: no se puede afirmar que sea válida sin saber dónde
 * queda, y afirmarlo es justo lo que rompe la vinculación.
 */
export function matchCity(province: string, value: string): CatalogMatch {
  const raw = value.trim();
  if (!raw) return EMPTY_MATCH;
  const exact = findCity(province, raw);
  return exact === null
    ? { status: 'unknown', value: raw }
    : { status: 'matched', value: exact };
}

export interface ResolvedLocation {
  province: CatalogMatch;
  city: CatalogMatch;
}

/**
 * Resuelve el par provincia/ciudad que devolvió un geocodificador.
 *
 * Es el punto exacto donde se arregla el bug. Georef devuelve
 * `provincia.nombre` y `localidad_censal.nombre`, que NO tienen por qué existir
 * en el catálogo de MELI: para una dirección de Martínez devuelve "Martínez", y
 * MP sólo conoce "San Isidro". Acá NO se inventa un mapeo ni se hace fuzzy
 * matching — lo que no matchea vuelve `unknown` y la UI se lo pregunta a la
 * persona, que es la única que sabe la respuesta.
 *
 * El caso porteño es el más ruidoso y conviene tenerlo presente: Georef manda
 * `localidad_censal: "Ciudad Autónoma de Buenos Aires"`, pero para MP las
 * "ciudades" de Capital Federal son los 60 BARRIOS (Palermo, Balvanera…). Así
 * que en CABA la provincia siempre resuelve y la localidad casi nunca: el
 * barrio lo elige la persona. Es correcto — es literalmente lo que MP pide.
 */
export function resolveGeocodedLocation(
  stateName: string,
  cityName: string,
): ResolvedLocation {
  const province = matchProvince(stateName);
  // Sin provincia reconocida la ciudad no se puede validar contra nada.
  const city =
    province.status === 'matched'
      ? matchCity(province.value, cityName)
      : cityName.trim()
        ? ({ status: 'unknown', value: cityName.trim() } as const)
        : EMPTY_MATCH;
  return { province, city };
}
