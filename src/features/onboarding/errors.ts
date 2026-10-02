import { ApiError } from '../../lib/api/client';
import { translateApiError, type EndpointKey } from '../../lib/api/translate';
import {
  ADDRESS_TEXT_FIELDS,
  type AddressTextField,
} from '../../shared/components/AddressPicker/addressUtils';
import { describeMissingAddressFields } from './validation';

/**
 * Traducción del error de ENVÍO de la solicitud de onboarding.
 *
 * Sigue el patrón de `features/auth/errors.ts`: la feature lee
 * `validationsErrors` y arma su mensaje; `translate.ts` sólo aporta el catálogo
 * genérico por `code`.
 *
 * ¿Por qué hace falta algo específico? El backend rechaza el submit con
 * `422 ONBOARDING_NOT_SUBMITTABLE` cuando la dirección estructurada está
 * incompleta. Ese `code` YA está traducido en `translate.ts`, así que nadie ve
 * el fallback genérico — pero el mensaje del catálogo es necesariamente
 * general ("Completá los datos requeridos antes de enviar la solicitud") y no
 * dice CUÁL de los campos falta.
 *
 * Y el caso real es justo el que más lo necesita: un borrador viejo que sólo
 * tiene el `address` de texto plano. La persona abre el wizard, ve su
 * dirección escrita en pantalla, aprieta "Enviar" y le dicen que complete
 * "los datos requeridos". Los datos, para ella, están. Lo que falta son los
 * campos SEPARADOS que ese borrador nunca tuvo, y hay que nombrarlos.
 */

/**
 * `declaredEntity.location.cityName` → `cityName`.
 *
 * Se queda con el último segmento y lo valida contra los campos que el
 * formulario conoce: un `field` que no sea de la dirección (o uno nuevo que
 * agregue el backend mañana) devuelve `null` y cae al mensaje genérico, en vez
 * de inventar una etiqueta.
 */
export function readAddressField(field: string): AddressTextField | null {
  const leaf = field.split('.').pop() ?? '';
  return (ADDRESS_TEXT_FIELDS as readonly string[]).includes(leaf)
    ? (leaf as AddressTextField)
    : null;
}

type ValidationItem = { field: string; code: string };

/** Los `validationsErrors` del problem+json, si vienen. */
function readValidationItems(error: unknown): ValidationItem[] {
  if (!(error instanceof ApiError) || !error.problem) return [];
  if (!('validationsErrors' in error.problem)) return [];
  const items = error.problem.validationsErrors;
  if (!Array.isArray(items)) return [];
  const result: ValidationItem[] = [];
  for (const item of items) {
    if (item.field) result.push({ field: item.field, code: item.code ?? '' });
  }
  return result;
}

const SCHEDULE_FIELD = /(^|\.)schedules(\.|\[|$)/;

/** Mensajes en español de los códigos de horarios que emite el backend. */
export const SCHEDULE_ERROR_MESSAGES: Record<string, string> = {
  SCHEDULE_INVALID_RANGE:
    'Revisá los horarios: la hora de cierre tiene que ser posterior a la de apertura.',
  SCHEDULE_OVERLAP:
    'Revisá los horarios: hay franjas que se superponen en un mismo día.',
};

const SCHEDULE_GENERIC_MESSAGE = 'Revisá los horarios de atención.';

/**
 * Mensaje de los horarios inválidos (422 con `declaredEntity.schedules.<i>`),
 * o `null` si el error no es de horarios. Si hay varios, gana el rango inválido
 * porque corregirlo suele resolver también el solape.
 */
export function describeScheduleErrors(
  items: readonly ValidationItem[],
): string | null {
  const schedule = items.filter((item) => SCHEDULE_FIELD.test(item.field));
  if (schedule.length === 0) return null;
  const invalid = schedule.find((i) => i.code === 'SCHEDULE_INVALID_RANGE');
  const picked = invalid ?? schedule[0];
  return SCHEDULE_ERROR_MESSAGES[picked.code] ?? SCHEDULE_GENERIC_MESSAGE;
}

export const PHONE_SERVER_MESSAGE = 'Ingresá un teléfono válido';

/**
 * Mensaje para el toast al fallar el alta (crear, guardar o enviar).
 *
 * Prioridad: dirección incompleta, horarios inválidos, teléfono inválido. Si
 * el 422/400 trae los campos de dirección que faltan, los nombra con LAS MISMAS
 * palabras que usa la validación local del paso 2. Si no —otro código, otro
 * campo, el backend viejo sin `validationsErrors`— delega en el catálogo de
 * `translate.ts`, que nunca muestra el `detail` crudo en inglés.
 */
export function mapSubmitError(
  error: unknown,
  endpoint: EndpointKey = 'onboarding.submit',
): string {
  const items = readValidationItems(error);
  const missing = items
    .map((item) => readAddressField(item.field))
    .filter((field): field is AddressTextField => field !== null);

  // Se respeta el orden canónico del formulario y no el del backend: leer
  // "falta la localidad, la calle y la altura" obliga a reordenar mentalmente
  // lo que ya está ordenado en pantalla.
  const ordered = ADDRESS_TEXT_FIELDS.filter((field) =>
    missing.includes(field),
  );

  if (ordered.length > 0) return describeMissingAddressFields(ordered);

  const scheduleMessage = describeScheduleErrors(items);
  if (scheduleMessage) return scheduleMessage;

  if (items.some((item) => item.field.split('.').pop() === 'phone')) {
    return PHONE_SERVER_MESSAGE;
  }

  return translateApiError(error, { endpoint });
}
