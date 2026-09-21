import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type MpAccount = components['schemas']['MpAccountDto'];
export type MpAccountStatus = components['schemas']['MpAccountStatus'];
export type MpAuthorizationUrl = components['schemas']['MpAuthorizationUrlDto'];
export type CreateMpAuthorizationUrlInput =
  components['schemas']['CreateMpAuthorizationUrlDto'];
export type MpOauthCallback = components['schemas']['MpOauthCallbackDto'];
export type MpOauthCallbackResult =
  components['schemas']['MpOauthCallbackResultDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /tenants/:tenantId/mercado-pago/account — la cuenta vinculada.
 *
 * OJO: "sin vincular" NO es un 200 con `null`, es un **404 `MP_NOT_LINKED`**.
 * Quien consuma esto tiene que atrapar el `ApiError` y tratar el 404 como
 * estado vacío, no como error: es el camino feliz de un estacionamiento que
 * todavía no conectó Mercado Pago.
 */
export async function getMpAccount(tenantId: string): Promise<MpAccount> {
  return apiRequest<MpAccount>({
    method: 'GET',
    path: `/tenants/${tenantId}/mercado-pago/account`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/mercado-pago/oauth/authorization-url — solo owner.
 * Arranca el flujo OAuth: devuelve la URL de Mercado Pago (con PKCE y un
 * `state` de un solo uso que vence a los 10 minutos) que el dueño tiene que
 * abrir para autorizar.
 *
 * `returnPath` es la ruta interna del panel a la que volver después del
 * callback. El backend la valida: tiene que ser relativa y empezar con una
 * sola `/`, si no responde 400 (así no se convierte en un open redirect).
 *
 * Responde **201**, no 200. Errores de negocio: 409 `MP_ALREADY_LINKED` y
 * 422 `MP_ENTITY_ADDRESS_INCOMPLETE`.
 */
export async function createMpAuthorizationUrl(
  tenantId: string,
  returnPath?: string,
): Promise<MpAuthorizationUrl> {
  const body: CreateMpAuthorizationUrlInput =
    returnPath === undefined ? {} : { returnPath };

  return apiRequest<MpAuthorizationUrl>({
    method: 'POST',
    path: `/tenants/${tenantId}/mercado-pago/oauth/authorization-url`,
    body,
    bearer: await bearer(),
  });
}

/**
 * DELETE /tenants/:tenantId/mercado-pago/account — solo owner. Desvincula la
 * cuenta y responde **204 sin body**, así que no hay nada que devolver.
 * Si no había nada vinculado responde 404 `MP_NOT_LINKED`.
 */
export async function unlinkMpAccount(tenantId: string): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/tenants/${tenantId}/mercado-pago/account`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/mercado-pago/pos/resync — solo owner. Vuelve a pedir
 * a Mercado Pago los datos del `POS` (el QR) y devuelve la cuenta actualizada.
 *
 * Es la salida cuando el QR quedó viejo o nunca se creó. No sirve si los
 * tokens ya no valen: ahí responde 409 `MP_ACCOUNT_TOKEN_EXPIRED` o
 * `MP_ACCOUNT_REVOKED` y hay que volver a vincular.
 */
export async function resyncMpPos(tenantId: string): Promise<MpAccount> {
  return apiRequest<MpAccount>({
    method: 'POST',
    path: `/tenants/${tenantId}/mercado-pago/pos/resync`,
    bearer: await bearer(),
  });
}

/**
 * POST /mercado-pago/oauth/callback — cierra el flujo OAuth canjeando el
 * `code` + `state` que devolvió Mercado Pago en el redirect.
 *
 * A diferencia del resto, esta ruta **no lleva `:tenantId`**: el tenant sale
 * del `state` guardado, porque Mercado Pago exige un `redirect_uri` fijo. Sí
 * requiere bearer: el backend verifica que quien vuelve sea el mismo que
 * arrancó el flujo.
 *
 * El `state` se consume de forma atómica, así que un callback reintentado
 * responde 400 `MP_OAUTH_STATE_INVALID`: no lo reintentes en loop.
 */
export async function completeMpOauth(
  body: MpOauthCallback,
): Promise<MpOauthCallbackResult> {
  return apiRequest<MpOauthCallbackResult>({
    method: 'POST',
    path: '/mercado-pago/oauth/callback',
    body,
    bearer: await bearer(),
  });
}
