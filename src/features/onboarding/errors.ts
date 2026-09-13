import { ApiError } from '../../lib/api/client';
import { translateApiError } from '../../lib/api/translate';
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

/** Los `validationsErrors` del problem+json, si vienen. */
function readValidationFields(error: unknown): string[] {
  if (!(error instanceof ApiError) || !error.problem) return [];
  if (!('validationsErrors' in error.problem)) return [];
  const items = error.problem.validationsErrors;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) =>
      item && typeof item === 'object' && 'field' in item
        ? String(item.field)
        : '',
    )
    .filter(Boolean);
}

/**
 * Mensaje para el toast al fallar el envío.
 *
 * Si el 422 trae los campos de dirección que faltan, los nombra con LAS MISMAS
 * palabras que usa la validación local del paso 1. Si no —otro código, otro
 * campo, el backend viejo sin `validationsErrors`— delega en el catálogo de
 * `translate.ts`, que nunca muestra el `detail` crudo en inglés.
 */
export function mapSubmitError(error: unknown): string {
  const missing = readValidationFields(error)
    .map(readAddressField)
    .filter((field): field is AddressTextField => field !== null);

  // Se respeta el orden canónico del formulario y no el del backend: leer
  // "falta la localidad, la calle y la altura" obliga a reordenar mentalmente
  // lo que ya está ordenado en pantalla.
  const ordered = ADDRESS_TEXT_FIELDS.filter((field) =>
    missing.includes(field),
  );

  if (ordered.length > 0) return describeMissingAddressFields(ordered);

  return translateApiError(error, { endpoint: 'onboarding.submit' });
}
