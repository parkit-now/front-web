import { describe, expect, it } from 'vitest';
import type { CashSession } from '../../services/cash-sessions';
import type { LprDetectionEvent } from '../../services/lpr-events';
import type { Entry, PaymentTransaction } from '../../services/operations';
import {
  attachPaymentsToEntries,
  computeSessionStats,
  filterEntryHistoryRows,
  paymentMethodFilterOptions,
} from './operationUtils';

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'entry-1',
    tenantId: 'tenant-1',
    plate: 'ABC123',
    enteredAt: '2026-09-21T10:00:00.000Z',
    source: 'manual',
    manuallyInvoiced: false,
    syncSeq: 1,
    updatedAt: '2026-09-21T10:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentTransaction>): PaymentTransaction {
  return {
    id: 'payment-1',
    tenantId: 'tenant-1',
    entryId: 'entry-1',
    cashSessionId: 'cash-1',
    amount: 1000,
    paymentMethodId: 'pm-cash',
    paymentMethodName: 'Efectivo',
    paymentMethodType: 'cash',
    syncSeq: 1,
    updatedAt: '2026-09-21T11:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function cashSession(overrides: Partial<CashSession>): CashSession {
  return {
    id: 'cash-1',
    tenantId: 'tenant-1',
    openedAt: '2026-09-21T09:00:00.000Z',
    openingCash: 500,
    syncSeq: 1,
    updatedAt: '2026-09-21T09:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('operation utils', () => {
  it('associates payment lines and exposes payment filter values', () => {
    const rows = attachPaymentsToEntries(
      [entry({ amountPaid: 3000 })],
      [
        payment({ id: 'payment-1', amount: 1000 }),
        payment({
          id: 'payment-2',
          amount: 2000,
          paymentMethodId: 'pm-mp',
          paymentMethodName: 'Mercado Pago',
          paymentMethodType: 'mercadopago_qr',
        }),
      ],
    );

    expect(rows[0].paymentLines).toHaveLength(2);
    expect(rows[0].paidTotal).toBe(3000);
    expect(rows[0].paymentMethodValues).toEqual(['pm-cash', 'pm-mp']);
  });

  it('associates a visible LPR history image by entry id', () => {
    const lprEvent = {
      id: 'lpr-1',
      entryId: 'entry-1',
      imageStoragePath: 'tenant/lpr-1.jpg',
      imageUrl: null,
      imageDeletedAt: null,
      lastSeenAt: '2026-09-21T10:02:00.000Z',
    } as LprDetectionEvent;

    const [row] = attachPaymentsToEntries([entry({})], [], [], [lprEvent]);

    expect(row.lprDetection).toBe(lprEvent);
    expect(row.historyImageUrl).toBeNull();
  });

  it('does not expose LPR images already deleted by retention', () => {
    const lprEvent = {
      id: 'lpr-1',
      entryId: 'entry-1',
      imageStoragePath: 'tenant/lpr-1.jpg',
      imageUrl: 'https://example.test/stale.jpg',
      imageDeletedAt: '2026-09-22T10:00:00.000Z',
      lastSeenAt: '2026-09-21T10:02:00.000Z',
    } as LprDetectionEvent;

    const [row] = attachPaymentsToEntries([entry({})], [], [], [lprEvent]);

    expect(row.lprDetection).toBeNull();
    expect(row.historyImageUrl).toBeNull();
  });

  it('filters out active entries unless include-in-lot is enabled', () => {
    const rows = attachPaymentsToEntries(
      [
        entry({ id: 'active', leftAt: undefined }),
        entry({ id: 'closed', leftAt: '2026-09-21T12:00:00.000Z' }),
      ],
      [],
    );

    expect(
      filterEntryHistoryRows(rows, {
        includeInLot: false,
        onlyCurrentSession: false,
      }).map((row) => row.id),
    ).toEqual(['closed']);

    expect(
      filterEntryHistoryRows(rows, {
        includeInLot: true,
        onlyCurrentSession: false,
      }).map((row) => row.id),
    ).toEqual(['closed', 'active']);
  });

  it('filters by active cash session', () => {
    const rows = attachPaymentsToEntries(
      [
        entry({
          id: 'cash-1-entry',
          cashSessionId: 'cash-1',
          leftAt: '2026-09-21T12:00:00.000Z',
        }),
        entry({
          id: 'cash-2-entry',
          cashSessionId: 'cash-2',
          leftAt: '2026-09-21T13:00:00.000Z',
        }),
      ],
      [],
    );

    expect(
      filterEntryHistoryRows(rows, {
        includeInLot: true,
        onlyCurrentSession: true,
        activeCashSessionId: 'cash-1',
      }).map((row) => row.id),
    ).toEqual(['cash-1-entry']);
  });

  it('builds payment method filter options from current transactions', () => {
    expect(
      paymentMethodFilterOptions([
        payment({ paymentMethodId: 'pm-cash', paymentMethodName: 'Efectivo' }),
        payment({
          id: 'payment-2',
          paymentMethodId: 'pm-mp',
          paymentMethodName: 'Mercado Pago',
          paymentMethodType: 'mercadopago_qr',
        }),
      ]),
    ).toEqual([
      { value: 'pm-cash', label: 'Efectivo' },
      { value: 'pm-mp', label: 'Mercado Pago' },
    ]);
  });

  it('computes cash-session totals and ignores non-cash methods for cash in box', () => {
    const session = cashSession({ openingCash: 700, leavingCash: 500 });
    const stats = computeSessionStats(
      session,
      [
        entry({
          id: 'entry-1',
          cashSessionId: 'cash-1',
          leftAt: '2026-09-21T11:00:00.000Z',
          rateSnapshotName: 'Auto',
        }),
        entry({
          id: 'entry-2',
          cashSessionId: 'cash-1',
          leftAt: undefined,
          rateSnapshotName: 'Auto',
        }),
      ],
      [
        payment({ entryId: 'entry-1', amount: 1000 }),
        payment({
          id: 'payment-2',
          entryId: 'entry-2',
          amount: 2000,
          paymentMethodId: 'pm-card',
          paymentMethodName: 'Tarjeta',
          paymentMethodType: 'other',
        }),
      ],
      new Date('2026-09-21T12:00:00.000Z').getTime(),
    );

    expect(stats.vehicleCount).toBe(2);
    expect(stats.vehiclesStillParked).toBe(1);
    expect(stats.summary.grandTotal).toBe(3000);
    expect(stats.summary.cashTotal).toBe(1700);
    expect(stats.withdrawnCash).toBe(1200);
    expect(stats.topRate).toEqual({ name: 'Auto', count: 2 });
  });
});

describe('computeSessionStats — cobrado por reservas', () => {
  const NOW = new Date('2026-09-21T18:00:00.000Z').getTime();

  it('suma el prepago de los que salieron, sin tocar el efectivo esperado', () => {
    const stats = computeSessionStats(
      cashSession({ openingCash: 700 }),
      [
        entry({
          id: 'entry-1',
          cashSessionId: 'cash-1',
          leftAt: '2026-09-21T11:00:00.000Z',
          prepaidAmountArs: 4500,
        }),
        entry({
          id: 'entry-2',
          cashSessionId: 'cash-1',
          leftAt: undefined,
          prepaidAmountArs: 3000,
        }),
      ],
      [payment({ entryId: 'entry-1', amount: 0 })],
      NOW,
    );
    expect(stats.reservationPrepaid).toBe(4500);
    expect(stats.summary.cashTotal).toBe(700);
    expect(stats.summary.grandTotal).toBe(0);
  });

  it('entró en una caja y salió en otra: cuenta en la de salida (la de sus pagos)', () => {
    const entries = [
      entry({
        id: 'entry-1',
        cashSessionId: 'cash-1', // caja de entrada
        leftAt: '2026-09-21T15:00:00.000Z',
        prepaidAmountArs: 1000,
      }),
    ];
    const payments = [
      payment({ entryId: 'entry-1', cashSessionId: 'cash-2', amount: 200 }),
    ];
    const closed = cashSession({
      id: 'cash-1',
      closedAt: '2026-09-21T14:00:00.000Z',
    });
    const exit = cashSession({
      id: 'cash-2',
      openedAt: '2026-09-21T14:00:00.000Z',
    });
    expect(
      computeSessionStats(closed, entries, payments, NOW).reservationPrepaid,
    ).toBe(0);
    expect(
      computeSessionStats(exit, entries, payments, NOW).reservationPrepaid,
    ).toBe(1000);
  });

  it('sin pagos (salida de $0) usa la ventana de la caja, con fin exclusivo', () => {
    const entries = [
      entry({
        id: 'entry-1',
        cashSessionId: 'cash-1',
        leftAt: '2026-09-21T14:00:00.000Z',
        prepaidAmountArs: 1000,
      }),
    ];
    const closed = cashSession({
      id: 'cash-1',
      closedAt: '2026-09-21T14:00:00.000Z',
    });
    const next = cashSession({
      id: 'cash-2',
      openedAt: '2026-09-21T14:00:00.000Z',
    });
    expect(
      computeSessionStats(closed, entries, [], NOW).reservationPrepaid,
    ).toBe(0);
    expect(computeSessionStats(next, entries, [], NOW).reservationPrepaid).toBe(
      1000,
    );
  });
});

describe('attachPaymentsToEntries — factura', () => {
  it('une la factura de la estadía y resuelve el estado y el receptor', () => {
    const [row] = attachPaymentsToEntries(
      [entry({ leftAt: '2026-09-21T12:00:00.000Z' })],
      [payment({})],
      [
        {
          id: 'inv-1',
          tenantId: 'tenant-1',
          entryId: 'entry-1',
          status: 'issued',
          cbteTipo: 1,
          ptoVta: 1,
          cbteNro: 3,
          receptorDocTipo: 80,
          receptorDocNro: '30712345671',
          receptorNombre: 'EMPRESA SA',
          impTotal: 1000,
          selectedPaymentIds: [],
          syncSeq: 1,
          version: 1,
          updatedAt: '2026-09-21T12:00:00.000Z',
        },
      ],
    );

    expect(row.invoiceState).toBe('issued');
    expect(row.invoiceLetterValue).toBe('A');
    expect(row.invoiceReceiver).toBe('EMPRESA SA · CUIT 30-71234567-1');
  });
});
