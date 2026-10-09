// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../../lib/notifications/ToastProvider';
import {
  getInvoicePreview,
  issueConfirmedInvoiceBatch,
  listInvoices,
} from '../../services/invoices';
import { listEntries } from '../../services/operations';
import { HistorialPage } from './HistorialPage';

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({ sucursalId: 'tenant', sucursal: { nombre: 'Apex' } }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'owner',
}));
vi.mock('../../hooks/useArcaAccount', () => ({
  useArcaAccount: () => ({ data: { status: 'linked' } }),
}));
vi.mock('../../services/operations', () => ({
  listEntries: vi.fn(),
  listPaymentTransactions: vi.fn(),
}));
vi.mock('../../services/cash-sessions', () => ({
  listAllCashSessions: vi.fn(),
}));
vi.mock('../../services/entities', () => ({
  listPaymentMethods: vi.fn(),
}));
vi.mock('../../services/invoices', () => ({
  listInvoices: vi.fn(),
  getInvoicePreview: vi.fn(),
  issueConfirmedInvoiceBatch: vi.fn(),
}));
vi.mock('../../services/lpr-events', () => ({
  getLprDetectionEventImageUrl: vi.fn(),
  listRegisteredLprDetectionEventsForEntries: () => Promise.resolve([]),
}));
vi.mock('./InvoiceDetail', () => ({
  InvoiceDetail: () => null,
}));

const date = '2026-10-09T10:00:00Z';
const entries = [
  {
    id: 'first',
    tenantId: 'tenant',
    plate: 'AA123BB',
    ticketNumber: 35,
    enteredAt: date,
    leftAt: date,
    amountPaid: 1000,
    source: 'manual',
    manuallyInvoiced: false,
    updatedAt: date,
    version: 1,
    syncSeq: 1,
  },
  {
    id: 'second',
    tenantId: 'tenant',
    plate: 'AC456DE',
    ticketNumber: 38,
    enteredAt: date,
    leftAt: date,
    amountPaid: 200,
    source: 'manual',
    manuallyInvoiced: false,
    updatedAt: date,
    version: 1,
    syncSeq: 2,
  },
];
const transactions = entries.map((entry, index) => ({
  id: `payment-${index}`,
  tenantId: 'tenant',
  entryId: entry.id,
  amount: entry.amountPaid,
  paymentMethodId: 'cash',
  paymentMethodName: 'Efectivo',
  paymentMethodType: 'cash',
  updatedAt: date,
  version: 1,
  syncSeq: index + 1,
}));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

async function clickButton(text: string, host: Element = container) {
  const button = [...host.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === text,
  );
  expect(button).toBeTruthy();
  await act(() => Promise.resolve(button!.click()));
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(listEntries).mockResolvedValue(entries);
  vi.mocked(listInvoices).mockResolvedValue([]);
  vi.mocked(getInvoicePreview).mockImplementation((_tenantId, entryId) =>
    Promise.resolve({ amount: entryId === 'first' ? 1250.25 : 200 }),
  );
  vi.mocked(issueConfirmedInvoiceBatch).mockResolvedValue([]);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const [key, value] of Object.entries({
    entries,
    'cash-sessions': [],
    'payment-transactions': transactions,
    'payment-methods': [{ id: 'cash', invoiceMode: 'manual' }],
    invoices: [],
  })) {
    client.setQueryData(['owner-operations', 'tenant', key], value);
  }
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => Promise.resolve(root.unmount()));
  client.clear();
  container.remove();
  localStorage.clear();
});

it('muestra comprobantes y montos antes de emitir; cancelar no factura', async () => {
  await act(() =>
    Promise.resolve(
      root.render(
        <QueryClientProvider client={client}>
          <ToastProvider>
            <MemoryRouter>
              <HistorialPage />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>,
      ),
    ),
  );

  const selectAll = container.querySelector<HTMLInputElement>(
    '[aria-label="Seleccionar las filas de esta página"]',
  );
  expect(selectAll).toBeTruthy();
  await act(() => Promise.resolve(selectAll!.click()));
  await clickButton('Emitir a consumidor final (2)');

  const dialog = container.querySelector('[aria-label="Confirmar emisión"]');
  expect(dialog).toBeTruthy();
  expect(dialog?.textContent).toContain('AA123BB');
  expect(dialog?.textContent).toContain('AC456DE');
  expect(dialog?.textContent).toContain('Ticket #35');
  expect(dialog?.textContent).toContain('$1.250,25');
  expect(dialog?.textContent).toContain('$200,00');
  expect(dialog?.textContent).toContain('$1.450,25');
  expect(issueConfirmedInvoiceBatch).not.toHaveBeenCalled();

  await clickButton('Cancelar', dialog!);
  expect(issueConfirmedInvoiceBatch).not.toHaveBeenCalled();
  expect(
    container.querySelector('[aria-label="Confirmar emisión"]'),
  ).toBeNull();

  await clickButton('Emitir a consumidor final (2)');
  await clickButton(
    'Emitir 2 facturas',
    container.querySelector('[aria-label="Confirmar emisión"]')!,
  );
  expect(issueConfirmedInvoiceBatch).toHaveBeenCalledWith('tenant', [
    { entryId: 'first', expectedAmount: 1250.25 },
    { entryId: 'second', expectedAmount: 200 },
  ]);
});
