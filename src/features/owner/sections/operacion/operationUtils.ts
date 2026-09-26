import type { CashSession } from '../../services/cash-sessions';
import type { Invoice } from '../../services/invoices';
import type { Entry, PaymentTransaction } from '../../services/operations';
import {
  invoiceLetter,
  resolveInvoiceState,
  type InvoiceState,
} from './invoiceUtils';

export type EntryHistoryRow = Entry & {
  enteredAtLocalDate: string;
  leftAtLocalDate: string;
  paymentLines: PaymentTransaction[];
  paymentMethodValues: string[];
  paidTotal: number | null;
  invoice: Invoice | null;
  invoiceState: InvoiceState;
  /** `A` / `B` / `C`, o `''`: para el filtro «Comprobante». */
  invoiceLetterValue: string;
  /** «Razón social · CUIT» del receptor de la A, o `''`: filtro «Receptor». */
  invoiceReceiver: string;
};

const DOC_TIPO_CUIT = 80;

function receiverLabel(invoice: Invoice | null): string {
  if (!invoice || invoice.receptorDocTipo !== DOC_TIPO_CUIT) return '';
  const cuit = invoice.receptorDocNro ?? '';
  return invoice.receptorNombre ? `${invoice.receptorNombre} · ${cuit}` : cuit;
}

export interface PaymentMethodSummary {
  pmId: string;
  pmName: string;
  total: number;
  count: number;
  isCash: boolean;
}

export interface SessionSummary {
  byPm: PaymentMethodSummary[];
  grandTotal: number;
  txCount: number;
  openingCash: number;
  cashCollected: number;
  cashTotal: number;
}

export interface SessionStats {
  session: CashSession;
  summary: SessionSummary;
  vehicleCount: number;
  vehiclesStillParked: number;
  paidEntryCount: number;
  averageTicket: number | null;
  averageStayMinutes: number | null;
  shiftDurationMinutes: number | null;
  topRate: { name: string; count: number } | null;
  withdrawnCash: number | null;
}

export function localDateKey(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function paymentMethodFilterValue(tx: PaymentTransaction): string {
  return tx.paymentMethodId ?? tx.paymentMethodName;
}

export function isCashMethod(tx: PaymentTransaction): boolean {
  return tx.paymentMethodType === 'cash';
}

export function cashSessionLabel(session: CashSession): string {
  const opened = new Date(session.openedAt);
  const prefix = session.closedAt ? 'Caja' : 'Caja activa';
  if (Number.isNaN(opened.getTime()))
    return `${prefix} ${session.id.slice(0, 8)}`;
  return `${prefix} ${opened.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })}`;
}

export function attachPaymentsToEntries(
  entries: Entry[],
  transactions: PaymentTransaction[],
  invoices: Invoice[] = [],
): EntryHistoryRow[] {
  const invoiceByEntryId = new Map(
    invoices.map((invoice) => [invoice.entryId, invoice]),
  );
  const paymentsByEntryId = new Map<string, PaymentTransaction[]>();
  for (const tx of transactions) {
    const lines = paymentsByEntryId.get(tx.entryId);
    if (lines) lines.push(tx);
    else paymentsByEntryId.set(tx.entryId, [tx]);
  }

  return entries.map((entry) => {
    const paymentLines = paymentsByEntryId.get(entry.id) ?? [];
    const lineTotal = paymentLines.reduce((sum, tx) => sum + tx.amount, 0);
    const paidTotal =
      paymentLines.length > 0
        ? lineTotal
        : entry.amountPaid != null
          ? entry.amountPaid
          : null;

    const invoice = invoiceByEntryId.get(entry.id) ?? null;
    const invoiceState = resolveInvoiceState(
      {
        leftAt: entry.leftAt,
        paidTotal,
        manuallyInvoiced: entry.manuallyInvoiced,
      },
      invoice ?? undefined,
    );
    // La letra y el receptor sólo cuentan si la factura existe en ARCA o se
    // está por emitir; una `not_required` no es comprobante de nada.
    const countsAsVoucher =
      invoiceState !== 'none' &&
      invoiceState !== 'na' &&
      invoiceState !== 'manual';

    return {
      ...entry,
      enteredAtLocalDate: localDateKey(entry.enteredAt),
      leftAtLocalDate: localDateKey(entry.leftAt),
      paymentLines,
      paymentMethodValues: paymentLines.map(paymentMethodFilterValue),
      paidTotal,
      invoice,
      invoiceState,
      invoiceLetterValue: countsAsVoucher
        ? (invoiceLetter(invoice?.cbteTipo) ?? '')
        : '',
      invoiceReceiver: countsAsVoucher ? receiverLabel(invoice) : '',
    };
  });
}

export function filterEntryHistoryRows(
  rows: EntryHistoryRow[],
  options: {
    includeInLot: boolean;
    onlyCurrentSession: boolean;
    activeCashSessionId?: string;
  },
): EntryHistoryRow[] {
  let filtered = options.includeInLot
    ? rows
    : rows.filter((entry) => Boolean(entry.leftAt));

  if (options.onlyCurrentSession) {
    filtered = options.activeCashSessionId
      ? filtered.filter(
          (entry) => entry.cashSessionId === options.activeCashSessionId,
        )
      : [];
  }

  return [...filtered].sort(
    (left, right) =>
      new Date(right.leftAt ?? right.enteredAt).getTime() -
      new Date(left.leftAt ?? left.enteredAt).getTime(),
  );
}

export function paymentMethodFilterOptions(
  transactions: PaymentTransaction[],
): Array<{ value: string; label: string }> {
  const byValue = new Map<string, string>();
  for (const tx of transactions) {
    byValue.set(paymentMethodFilterValue(tx), tx.paymentMethodName);
  }
  return [...byValue.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'es'));
}

export function computeSessionSummary(
  transactions: PaymentTransaction[],
  openingCash: number,
): SessionSummary {
  const byPmMap = new Map<string, PaymentMethodSummary>();
  let grandTotal = 0;

  for (const tx of transactions) {
    const key = paymentMethodFilterValue(tx);
    const existing = byPmMap.get(key);
    if (existing) {
      existing.total += tx.amount;
      existing.count += 1;
    } else {
      byPmMap.set(key, {
        pmId: key,
        pmName: tx.paymentMethodName,
        total: tx.amount,
        count: 1,
        isCash: isCashMethod(tx),
      });
    }
    grandTotal += tx.amount;
  }

  const byPm = [...byPmMap.values()].sort(
    (left, right) =>
      right.total - left.total || left.pmName.localeCompare(right.pmName, 'es'),
  );
  const cashCollected = byPm
    .filter((pm) => pm.isCash)
    .reduce((sum, pm) => sum + pm.total, 0);

  return {
    byPm,
    grandTotal,
    txCount: transactions.length,
    openingCash,
    cashCollected,
    cashTotal: openingCash + cashCollected,
  };
}

export function computeSummariesBySession(
  sessions: CashSession[],
  transactions: PaymentTransaction[],
): Map<string, SessionSummary> {
  const txBySession = new Map<string, PaymentTransaction[]>();
  for (const tx of transactions) {
    if (!tx.cashSessionId) continue;
    const bucket = txBySession.get(tx.cashSessionId);
    if (bucket) bucket.push(tx);
    else txBySession.set(tx.cashSessionId, [tx]);
  }

  const summaries = new Map<string, SessionSummary>();
  for (const session of sessions) {
    summaries.set(
      session.id,
      computeSessionSummary(
        txBySession.get(session.id) ?? [],
        session.openingCash,
      ),
    );
  }
  return summaries;
}

function minutesBetween(from: string, to: string): number | null {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  const minutes = (toMs - fromMs) / 60000;
  return minutes < 0 ? null : minutes;
}

function topRate(entries: Entry[]): { name: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.rateSnapshotName) continue;
    counts.set(
      entry.rateSnapshotName,
      (counts.get(entry.rateSnapshotName) ?? 0) + 1,
    );
  }

  let top: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (!top || count > top.count) top = { name, count };
  }
  return top;
}

export function computeSessionStats(
  session: CashSession,
  entries: Entry[],
  transactions: PaymentTransaction[],
  now: number = Date.now(),
): SessionStats {
  const sessionEntries = entries.filter(
    (entry) => entry.cashSessionId === session.id,
  );
  const sessionTransactions = transactions.filter(
    (tx) => tx.cashSessionId === session.id,
  );
  const summary = computeSessionSummary(
    sessionTransactions,
    session.openingCash,
  );
  const paidEntryCount = new Set(sessionTransactions.map((tx) => tx.entryId))
    .size;
  const stays = sessionEntries
    .map((entry) =>
      entry.leftAt ? minutesBetween(entry.enteredAt, entry.leftAt) : null,
    )
    .filter((minutes): minutes is number => minutes !== null);
  const withdrawnCash =
    session.leavingCash != null
      ? summary.cashTotal - session.leavingCash
      : null;

  return {
    session,
    summary,
    vehicleCount: sessionEntries.length,
    vehiclesStillParked: sessionEntries.filter((entry) => !entry.leftAt).length,
    paidEntryCount,
    averageTicket:
      paidEntryCount > 0 ? summary.grandTotal / paidEntryCount : null,
    averageStayMinutes:
      stays.length > 0
        ? stays.reduce((sum, minutes) => sum + minutes, 0) / stays.length
        : null,
    shiftDurationMinutes: minutesBetween(
      session.openedAt,
      session.closedAt ?? new Date(now).toISOString(),
    ),
    topRate: topRate(sessionEntries),
    withdrawnCash,
  };
}

export function computeStatsBySession(
  sessions: CashSession[],
  entries: Entry[],
  transactions: PaymentTransaction[],
  now?: number,
): Map<string, SessionStats> {
  const stats = new Map<string, SessionStats>();
  for (const session of sessions) {
    stats.set(
      session.id,
      computeSessionStats(session, entries, transactions, now),
    );
  }
  return stats;
}
