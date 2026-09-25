import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type ArcaAccount = components['schemas']['ArcaAccountDto'];
export type ArcaAccountStatus = components['schemas']['ArcaAccountStatus'];
export type ArcaEnvironment = components['schemas']['ArcaEnvironment'];
export type ArcaTaxCondition = components['schemas']['ArcaTaxCondition'];
export type ArcaCsr = components['schemas']['ArcaCsrDto'];
export type ArcaCertificateResult =
  components['schemas']['ArcaCertificateResultDto'];
export type ArcaReusableCertificate =
  components['schemas']['ArcaReusableCertificateDto'];
export type CreateArcaAccountInput =
  components['schemas']['CreateArcaAccountDto'];
export type UpdateArcaAccountInput =
  components['schemas']['UpdateArcaAccountDto'];
export type UploadArcaCertificateInput =
  components['schemas']['UploadArcaCertificateDto'];
export type SetArcaSalesPointInput =
  components['schemas']['SetArcaSalesPointDto'];
export type ReuseArcaCertificateInput =
  components['schemas']['ReuseArcaCertificateDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /tenants/:tenantId/arca/account — la cuenta de facturación electrónica
 * (ARCA) vinculada.
 *
 * OJO: igual que Mercado Pago, "sin vincular" NO es un 200 con `null`, es un
 * **404 `ARCA_NOT_LINKED`**. Una cuenta desvinculada (DELETE) también cae acá:
 * el camino feliz de una playa que nunca vinculó y el de una que se desvinculó
 * son el mismo 404. Quien consuma esto tiene que atrapar el `ApiError` y
 * tratar el 404 como estado vacío (ver `useArcaAccount`).
 */
export async function getArcaAccount(tenantId: string): Promise<ArcaAccount> {
  return apiRequest<ArcaAccount>({
    method: 'GET',
    path: `/tenants/${tenantId}/arca/account`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/arca/account — solo owner. Arranca la vinculación
 * (paso 1 del wizard): valida el CUIT y crea la cuenta en `pending_certificate`.
 *
 * Volver a llamarlo con un wizard a medias arranca de cero (el backend no
 * tiene un endpoint de "reiniciar" separado). Errores: 409 `ARCA_ALREADY_LINKED`,
 * 422 `ARCA_CUIT_INVALID`, 503 `ARCA_UNAVAILABLE`.
 */
export async function createArcaAccount(
  tenantId: string,
  body: CreateArcaAccountInput,
): Promise<ArcaAccount> {
  return apiRequest<ArcaAccount>({
    method: 'POST',
    path: `/tenants/${tenantId}/arca/account`,
    body,
    bearer: await bearer(),
  });
}

/**
 * DELETE /tenants/:tenantId/arca/account — solo owner. Desvincula la cuenta
 * (o cancela un wizard a medias) y responde **204 sin body**. Pone todos los
 * medios de pago en `invoiceMode: 'none'` y conserva las facturas ya emitidas.
 */
export async function unlinkArcaAccount(tenantId: string): Promise<void> {
  await apiRequest<void>({
    method: 'DELETE',
    path: `/tenants/${tenantId}/arca/account`,
    bearer: await bearer(),
  });
}

/**
 * PATCH /tenants/:tenantId/arca/account — solo owner. Actualiza la alícuota de
 * IVA (cualquier entorno) y, sólo si `fiscalDataEditable` (homologación con
 * padrón sin datos), los datos fiscales cargados a mano. 409
 * `ARCA_LINK_STEP_INVALID` si se intenta fuera de ese paso.
 */
export async function updateArcaAccount(
  tenantId: string,
  body: UpdateArcaAccountInput,
): Promise<ArcaAccount> {
  return apiRequest<ArcaAccount>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/arca/account`,
    body,
    bearer: await bearer(),
  });
}

/**
 * GET /tenants/:tenantId/arca/account/csr — la solicitud de certificado (CSR)
 * a subir en ARCA. 409 `ARCA_LINK_STEP_INVALID` si la cuenta ya pasó este paso.
 */
export async function getArcaCsr(tenantId: string): Promise<ArcaCsr> {
  return apiRequest<ArcaCsr>({
    method: 'GET',
    path: `/tenants/${tenantId}/arca/account/csr`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/arca/account/certificate — solo owner. Sube el
 * `.crt` que devolvió ARCA (como texto PEM) y lo verifica contra el padrón.
 * Puede tardar varios segundos: habla con ARCA.
 *
 * Errores 422 posibles: `ARCA_CERT_INVALID`, `ARCA_CERT_CUIT_MISMATCH`,
 * `ARCA_CERT_KEY_MISMATCH`, `ARCA_CERT_EXPIRED`, `ARCA_CERT_NOT_AUTHORIZED`,
 * `ARCA_PADRON_NOT_FOUND`. 409 `ARCA_LINK_STEP_INVALID`, 503 `ARCA_UNAVAILABLE`.
 */
export async function uploadArcaCertificate(
  tenantId: string,
  body: UploadArcaCertificateInput,
): Promise<ArcaCertificateResult> {
  return apiRequest<ArcaCertificateResult>({
    method: 'POST',
    path: `/tenants/${tenantId}/arca/account/certificate`,
    body,
    bearer: await bearer(),
  });
}

/**
 * GET /tenants/:tenantId/arca/account/reusable-certificates — otras sedes del
 * mismo dueño ya vinculadas con el MISMO CUIT, cuyo certificado se puede
 * reutilizar en vez de generar uno nuevo.
 */
export async function listArcaReusableCertificates(
  tenantId: string,
): Promise<ArcaReusableCertificate[]> {
  return apiRequest<ArcaReusableCertificate[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/arca/account/reusable-certificates`,
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/arca/account/reuse-certificate — solo owner. Copia
 * el certificado (y los datos fiscales) de `fromTenantId` a esta sede, que
 * pasa a `pending_sales_point`. 409 `ARCA_LINK_STEP_INVALID`.
 */
export async function reuseArcaCertificate(
  tenantId: string,
  body: ReuseArcaCertificateInput,
): Promise<ArcaAccount> {
  return apiRequest<ArcaAccount>({
    method: 'POST',
    path: `/tenants/${tenantId}/arca/account/reuse-certificate`,
    body,
    bearer: await bearer(),
  });
}

/**
 * PUT /tenants/:tenantId/arca/account/sales-point/constancia — solo owner.
 * Sube la constancia del punto de venta como bytes crudos de PDF (máx 5 MB),
 * no como un DTO JSON. Obligatoria sólo en producción antes del alta del
 * punto de venta (`ARCA_POS_CONSTANCIA_REQUIRED` si falta).
 */
export async function uploadArcaSalesPointConstancia(
  tenantId: string,
  file: Blob,
): Promise<ArcaAccount> {
  return apiRequest<ArcaAccount>({
    method: 'PUT',
    path: `/tenants/${tenantId}/arca/account/sales-point/constancia`,
    rawBody: file,
    rawContentType: 'application/pdf',
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/arca/account/sales-point — solo owner. Da de alta el
 * punto de venta y, si sale bien, deja la cuenta `linked`. Errores 422:
 * `ARCA_POS_NOT_FOUND`, `ARCA_POS_DISABLED`, `ARCA_POS_CONSTANCIA_REQUIRED`,
 * `ARCA_PADRON_NOT_FOUND`. 503 `ARCA_UNAVAILABLE`.
 */
export async function setArcaSalesPoint(
  tenantId: string,
  body: SetArcaSalesPointInput,
): Promise<ArcaAccount> {
  return apiRequest<ArcaAccount>({
    method: 'POST',
    path: `/tenants/${tenantId}/arca/account/sales-point`,
    body,
    bearer: await bearer(),
  });
}
