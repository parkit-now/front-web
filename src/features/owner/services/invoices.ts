import type { components } from '../../../generated/api-types';
import { apiRequest, apiRequestFile } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Invoice = components['schemas']['InvoiceDto'];
export type InvoiceSummary = components['schemas']['InvoiceSummaryDto'];
export type InvoiceStatus = components['schemas']['InvoiceStatus'];
export type InvoiceBatchResult = components['schemas']['InvoiceBatchItemDto'];
type InvoiceChangesResponse =
  components['schemas']['InvoiceChangesResponseDto'];
type InvoiceBatchResponse = components['schemas']['InvoiceBatchResponseDto'];
type Entry = components['schemas']['EntryDto'];

const CHANGES_PAGE_SIZE = 500;
/** Tope del backend por request (`INVOICE_BATCH_MAX`). */
export const INVOICE_BATCH_MAX = 50;

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * Todas las facturas de la sede, por el feed de sync (el mismo que baja el
 * desktop). El Historial las une a las estadías del lado del cliente, igual
 * que los pagos.
 */
export async function listInvoices(tenantId: string): Promise<Invoice[]> {
  const token = await bearer();
  const all: Invoice[] = [];
  let afterSeq = 0;

  while (true) {
    const params = new URLSearchParams({
      afterSeq: String(afterSeq),
      limit: String(CHANGES_PAGE_SIZE),
    });
    const page = await apiRequest<InvoiceChangesResponse>({
      method: 'GET',
      path: `/tenants/${encodeURIComponent(tenantId)}/invoices/changes?${params.toString()}`,
      bearer: token,
    });

    const items = page.items ?? [];
    all.push(...items);
    if (items.length < CHANGES_PAGE_SIZE || page.maxSeq <= afterSeq) break;
    afterSeq = page.maxSeq;
  }

  return all;
}

/**
 * POST /tenants/:tenantId/entries/:entryId/invoice — emite (o reintenta) a
 * consumidor final. Que ARCA esté caída o rechace NO es un error HTTP: vuelve
 * en `status`/`errorCode` de la factura. Sí tiran los conflictos
 * (`INVOICE_ALREADY_ISSUED`, `INVOICE_IN_PROGRESS`, `INVOICE_NOT_INVOICEABLE`,
 * `ARCA_NOT_LINKED`).
 */
export async function issueInvoice(
  tenantId: string,
  entryId: string,
): Promise<InvoiceSummary> {
  return apiRequest<InvoiceSummary>({
    method: 'POST',
    path: `/tenants/${encodeURIComponent(tenantId)}/entries/${encodeURIComponent(entryId)}/invoice`,
    body: {},
    bearer: await bearer(),
  });
}

/**
 * POST /tenants/:tenantId/invoices/batch, de a `INVOICE_BATCH_MAX` por
 * request y en orden: devuelve el resultado de cada estadía.
 */
export async function issueInvoiceBatch(
  tenantId: string,
  entryIds: readonly string[],
): Promise<InvoiceBatchResult[]> {
  const token = await bearer();
  const results: InvoiceBatchResult[] = [];
  for (let start = 0; start < entryIds.length; start += INVOICE_BATCH_MAX) {
    const page = await apiRequest<InvoiceBatchResponse>({
      method: 'POST',
      path: `/tenants/${encodeURIComponent(tenantId)}/invoices/batch`,
      body: { entryIds: entryIds.slice(start, start + INVOICE_BATCH_MAX) },
      bearer: token,
    });
    results.push(...page.results);
  }
  return results;
}

/** GET /tenants/:tenantId/invoices/:invoiceId/pdf — sólo facturas emitidas. */
export async function downloadInvoicePdf(
  tenantId: string,
  invoiceId: string,
): Promise<{ blob: Blob; fileName: string }> {
  const { blob, fileName } = await apiRequestFile({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(tenantId)}/invoices/${encodeURIComponent(invoiceId)}/pdf`,
    bearer: await bearer(),
  });
  return { blob, fileName: fileName ?? 'factura.pdf' };
}

/**
 * Checkbox «Facturada» de las playas sin ARCA: PATCH de la corrección con
 * optimistic locking (`expectedVersion`). Se permite aunque la caja esté
 * cerrada.
 */
export async function setEntryManuallyInvoiced(
  tenantId: string,
  entry: Pick<Entry, 'id' | 'version'>,
  manuallyInvoiced: boolean,
): Promise<Entry> {
  return apiRequest<Entry>({
    method: 'PATCH',
    path: `/tenants/${encodeURIComponent(tenantId)}/entries/${encodeURIComponent(entry.id)}/correction?expectedVersion=${entry.version}`,
    body: { manuallyInvoiced },
    bearer: await bearer(),
  });
}
