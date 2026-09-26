import type { Invoice } from '../../services/invoices';

// OJO: `formatVoucherNumber`, `invoiceLetter` y `resolveInvoiceState` están
// duplicadas en front-desktop (`src/features/entries/invoiceUtils.ts`). Si
// cambia una, cambiar la otra: web y desktop tienen que mostrar lo mismo.

/**
 * Estado de facturación de un cobro, como lo ve el dueño:
 * - `issued` / `issuing` / `error` / `pending`: el de la factura de ARCA.
 * - `manual`: sin factura de ARCA, marcada «Facturada» a mano.
 * - `none`: cobrada y sin factura (medio sin facturación, o playa sin ARCA).
 * - `na`: no se factura (auto en base, o cobro de $0).
 */
export type InvoiceState =
  | 'issued'
  | 'issuing'
  | 'error'
  | 'pending'
  | 'manual'
  | 'none'
  | 'na';

export const INVOICE_STATE_LABEL: Record<InvoiceState, string> = {
  issued: 'Facturada',
  issuing: 'Emitiendo',
  error: 'Con error',
  pending: 'Pendiente',
  manual: 'Facturada a mano',
  none: 'Sin factura',
  na: 'No aplica',
};

export const INVOICE_STATE_VARIANT: Record<
  InvoiceState,
  'ok' | 'warn' | 'err' | 'default' | 'brand'
> = {
  issued: 'ok',
  issuing: 'brand',
  error: 'err',
  pending: 'warn',
  manual: 'ok',
  none: 'default',
  na: 'default',
};

/** Orden de las opciones del filtro «Facturación». */
export const INVOICE_STATE_ORDER: readonly InvoiceState[] = [
  'pending',
  'none',
  'error',
  'issuing',
  'issued',
  'manual',
  'na',
];

const LETTER_BY_TIPO: Readonly<Record<number, 'A' | 'B' | 'C'>> = {
  1: 'A',
  6: 'B',
  11: 'C',
};

export function invoiceLetter(
  cbteTipo: number | null | undefined,
): 'A' | 'B' | 'C' | null {
  return cbteTipo != null ? (LETTER_BY_TIPO[cbteTipo] ?? null) : null;
}

/** `0001-00000123`: punto de venta (4) y número (8), como en ARCA. */
export function formatVoucherNumber(
  ptoVta: number | null | undefined,
  cbteNro: number | null | undefined,
): string | null {
  if (ptoVta == null || cbteNro == null) return null;
  return `${String(ptoVta).padStart(4, '0')}-${String(cbteNro).padStart(8, '0')}`;
}

/** «Factura B 0001-00000123», o sólo «Factura B» si todavía no tiene número. */
export function voucherLabel(
  invoice: Pick<Invoice, 'cbteTipo' | 'ptoVta' | 'cbteNro'>,
): string | null {
  const letter = invoiceLetter(invoice.cbteTipo);
  if (!letter) return null;
  const number = formatVoucherNumber(invoice.ptoVta, invoice.cbteNro);
  return number ? `Factura ${letter} ${number}` : `Factura ${letter}`;
}

export function resolveInvoiceState(
  entry: {
    leftAt?: string | null;
    paidTotal: number | null;
    manuallyInvoiced?: boolean;
  },
  invoice: Pick<Invoice, 'status'> | undefined,
): InvoiceState {
  switch (invoice?.status) {
    case 'issued':
    case 'issuing':
    case 'error':
    case 'pending':
      return invoice.status;
    default:
      break;
  }
  if (!entry.leftAt || !(entry.paidTotal != null && entry.paidTotal > 0)) {
    return 'na';
  }
  return entry.manuallyInvoiced ? 'manual' : 'none';
}

/** «Sin facturar» = Pendiente + Sin factura + Con error. */
export function isUnbilled(state: InvoiceState): boolean {
  return state === 'pending' || state === 'none' || state === 'error';
}

export type InvoiceChip = 'all' | 'unbilled' | 'error';

export function matchesInvoiceChip(
  state: InvoiceState,
  chip: InvoiceChip,
): boolean {
  if (chip === 'unbilled') return isUnbilled(state);
  if (chip === 'error') return state === 'error';
  return true;
}

export function countInvoiceChips(
  rows: ReadonlyArray<{ invoiceState: InvoiceState }>,
): Record<InvoiceChip, number> {
  return {
    all: rows.length,
    unbilled: rows.filter((row) => isUnbilled(row.invoiceState)).length,
    error: rows.filter((row) => row.invoiceState === 'error').length,
  };
}

/**
 * Se puede emitir a pedido desde Parkit: pendiente, sin factura o con error,
 * y la playa tiene ARCA vinculada (o con el certificado vencido: la emisión
 * lo avisa).
 */
export function canIssueInvoice(
  state: InvoiceState,
  arcaLinked: boolean,
): boolean {
  return arcaLinked && isUnbilled(state);
}

/**
 * `2026-10-04` → `04/10/2026`. Fechas sin hora (CAE, comprobante): no pasan
 * por `Date`, que las leería a las 00:00 UTC y en Argentina daría el día
 * anterior.
 */
export function formatIsoDay(value: string | null | undefined): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

/** «EMPRESA SA · CUIT 30-71234567-1», o «Consumidor final». */
export function receiverDescription(
  invoice: Pick<
    Invoice,
    'receptorDocTipo' | 'receptorDocNro' | 'receptorNombre'
  >,
): string {
  if (invoice.receptorDocTipo !== 80 || !invoice.receptorDocNro) {
    return 'Consumidor final';
  }
  const raw = invoice.receptorDocNro;
  const cuit =
    raw.length === 11
      ? `${raw.slice(0, 2)}-${raw.slice(2, 10)}-${raw.slice(10)}`
      : raw;
  return invoice.receptorNombre
    ? `${invoice.receptorNombre} · CUIT ${cuit}`
    : `CUIT ${cuit}`;
}
