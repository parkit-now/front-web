import type { ArcaTaxCondition } from '../../services/arca';
import type { Invoice, Taxpayer } from '../../services/invoices';
import { isValidArcaCuit, normalizeArcaCuit } from '../integraciones/arca/cuit';

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

/**
 * «Sin facturar» = Pendiente + Sin factura + Con error: una con error tampoco
 * está facturada, así que va en el mismo chip (no hay uno aparte).
 */
export function isUnbilled(state: InvoiceState): boolean {
  return state === 'pending' || state === 'none' || state === 'error';
}

export type InvoiceChip = 'all' | 'unbilled';

export function matchesInvoiceChip(
  state: InvoiceState,
  chip: InvoiceChip,
): boolean {
  return chip === 'unbilled' ? isUnbilled(state) : true;
}

export function countInvoiceChips(
  rows: ReadonlyArray<{ invoiceState: InvoiceState }>,
): Record<InvoiceChip, number> {
  return {
    all: rows.length,
    unbilled: rows.filter((row) => isUnbilled(row.invoiceState)).length,
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

/** Siempre termina en `.pdf`, venga como venga el nombre. */
export function pdfFileName(name: string | null, fallback: string): string {
  const base = (name ?? '').trim() || fallback;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

// ── Receptor: consumidor final o con CUIT ──────────────────────────────────
// Gemelo del cobro del desktop (`front-desktop/src/features/entries/
// invoiceUtils.ts`): si cambia acá, cambiar allá.

export type InvoiceLetter = 'A' | 'B' | 'C';

/** A quién se factura: consumidor final (la de siempre) o el CUIT del cliente. */
export type ReceiverChoice = 'final' | 'cuit';

/** La letra a consumidor final: B si la sede es RI; C si no. */
export function consumerFinalLetter(
  emitter: ArcaTaxCondition | null | undefined,
): InvoiceLetter {
  return emitter === 'responsable_inscripto' ? 'B' : 'C';
}

/** Cómo va la consulta al padrón del CUIT tipeado. */
export type TaxpayerLookup =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly taxpayer: Taxpayer }
  | { readonly status: 'error'; readonly message: string };

/** `30712345671` → `30-71234567-1`. */
export function formatCuit(raw: string): string {
  const cuit = normalizeArcaCuit(raw);
  return cuit.length === 11
    ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
    : raw;
}

/** Mensaje del campo CUIT, o `null` si está bien. */
export function receiverCuitError(raw: string): string | null {
  const cuit = normalizeArcaCuit(raw);
  if (cuit.length === 0) return 'Ingresá el CUIT del cliente.';
  if (!isValidArcaCuit(cuit)) return 'El CUIT no es válido.';
  return null;
}

/**
 * El receptor que se manda al backend, o `undefined` = consumidor final.
 *
 * - Un CUIT que ARCA no tiene (producción) no se manda: la factura va a
 *   consumidor final, como ya se le avisó al dueño.
 * - Si la consulta falló (ARCA caída) se manda igual: el backend vuelve a
 *   consultar al emitir y, si sigue caída, la factura queda para reintentar.
 */
export function receiverCuitToSend(input: {
  readonly choice: ReceiverChoice;
  readonly cuit: string;
  readonly lookup: TaxpayerLookup;
}): string | undefined {
  if (input.choice !== 'cuit') return undefined;
  const cuit = normalizeArcaCuit(input.cuit);
  if (!isValidArcaCuit(cuit)) return undefined;
  if (input.lookup.status === 'done' && !input.lookup.taxpayer.identified) {
    return undefined;
  }
  return cuit;
}

/**
 * Si ya se puede emitir: a consumidor final siempre; con CUIT, cuando es
 * válido y la consulta al padrón terminó (bien o mal).
 */
export function isReceiverReady(input: {
  readonly choice: ReceiverChoice;
  readonly cuit: string;
  readonly lookup: TaxpayerLookup;
}): boolean {
  if (input.choice === 'final') return true;
  return (
    isValidArcaCuit(input.cuit) &&
    (input.lookup.status === 'done' || input.lookup.status === 'error')
  );
}

/**
 * La letra que va a salir, para el botón. `null` si no se sabe todavía: con
 * CUIT y sin respuesta del padrón (una sede RI puede emitir A o B).
 */
export function expectedLetter(input: {
  readonly emitter: ArcaTaxCondition | null | undefined;
  readonly choice: ReceiverChoice;
  readonly lookup: TaxpayerLookup;
}): InvoiceLetter | null {
  const consumer = consumerFinalLetter(input.emitter);
  if (input.choice === 'final' || consumer === 'C') return consumer;
  return input.lookup.status === 'done' ? input.lookup.taxpayer.letter : null;
}

export interface TaxpayerNotice {
  readonly tone: 'success' | 'info' | 'warning';
  readonly text: string;
  readonly detail?: string;
}

/**
 * La línea debajo del CUIT con lo que dijo el padrón: qué letra sale y a
 * quién. `null` mientras no hay nada que decir.
 */
export function describeTaxpayerLookup(
  lookup: TaxpayerLookup,
): TaxpayerNotice | null {
  switch (lookup.status) {
    case 'idle':
      return null;
    case 'loading':
      return { tone: 'info', text: 'Consultando ARCA…' };
    case 'error':
      return {
        tone: 'warning',
        text: lookup.message,
        detail: 'Se vuelve a consultar al emitir.',
      };
    case 'done': {
      const t = lookup.taxpayer;
      if (!t.identified) {
        return {
          tone: 'warning',
          text: 'ARCA no tiene datos de ese CUIT.',
          detail: `Se emite Factura ${t.letter} a consumidor final.`,
        };
      }
      const who = t.razonSocial ?? `CUIT ${formatCuit(t.cuit)}`;
      if (t.assumed) {
        return {
          tone: 'info',
          text: `Factura ${t.letter} · ${who}`,
          detail:
            'Homologación: ARCA no tiene datos de prueba de este CUIT, se toma como Responsable Inscripto.',
        };
      }
      // Una sede RI que no puede emitir A (receptor exento, consumidor
      // final): se aclara por qué sale B, que es lo que el cliente no espera.
      return {
        tone: t.letter === 'B' ? 'info' : 'success',
        text: `Factura ${t.letter} · ${who}`,
        detail:
          t.letter === 'B' && t.condicionIva
            ? `${t.condicionIva}: no recibe Factura A.`
            : (t.condicionIva ?? undefined),
      };
    }
  }
}
