// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvoiceDetail } from './InvoiceDetail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EntryHistoryRow } from './operationUtils';
import { setEntryExternalInvoice } from '../../services/invoices';

vi.mock('../../../../lib/notifications/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../services/invoices', () => ({
  getInvoiceDocument: vi.fn(),
  setEntryManualInvoiceNumber: vi.fn(),
  setEntryManuallyInvoiced: vi.fn(),
  setEntryExternalInvoice: vi.fn(),
}));
vi.mock('./useInvoiceReceiver', () => ({
  useInvoiceReceiver: () => ({
    choice: 'final',
    lookup: { status: 'idle' },
    ready: true,
  }),
}));
vi.mock('./useInvoiceConfirmation', () => ({
  useInvoiceConfirmation: () => ({ busy: false, snapshot: null }),
}));
vi.mock('../clientes/ClientContact', () => ({
  ClientContact: () => null,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it('muestra el número de la factura manual en un campo editable', () => {
  const row = {
    id: 'entry-1',
    version: 2,
    plate: 'IAG574',
    invoice: null,
    invoiceState: 'manual',
    manualInvoiceNumber: '0001-00000042',
  } as EntryHistoryRow;

  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <InvoiceDetail
          row={row}
          tenantId="tenant-1"
          arca="none"
          emitter={null}
          paymentModeAllowed
          onChanged={vi.fn()}
        />
      </QueryClientProvider>,
    );
  });

  expect(container.textContent).toContain('Facturada');
  expect(
    container.querySelector<HTMLInputElement>(
      'input[id^="manual-invoice-number-"]',
    )?.value,
  ).toBe('0001-00000042');
  expect(
    container.querySelector('[aria-label="Guardar número de factura"]'),
  ).not.toBeNull();
});

it('con ARCA ofrece registrar una pendiente y no emitir si ya es externa', () => {
  const row = {
    id: 'entry-2',
    version: 2,
    plate: 'ABC123',
    invoice: { status: 'pending' },
    invoiceState: 'pending',
    manuallyInvoiced: false,
  } as EntryHistoryRow;
  const renderRow = (current: EntryHistoryRow, paymentModeAllowed = true) =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <InvoiceDetail
          row={current}
          tenantId="tenant-1"
          arca="linked"
          emitter="monotributo"
          paymentModeAllowed={paymentModeAllowed}
          onChanged={vi.fn()}
        />
      </QueryClientProvider>,
    );

  act(() => renderRow(row));
  expect(container.textContent).toContain('Registrar factura externa');
  expect(container.textContent).toContain('Emitir factura');

  act(() => renderRow(row, false));
  expect(container.textContent).not.toContain('Emitir factura');

  act(() =>
    renderRow({
      ...row,
      invoiceState: 'manual',
      manuallyInvoiced: true,
      manualInvoiceType: 'C',
      manualInvoicePointOfSale: '12',
      manualInvoiceNumber: '123',
    }),
  );
  expect(container.textContent).toContain('Factura C 00012-00000123');
  expect(container.textContent).not.toContain('Emitir factura');
});

it('guarda tipo, punto de venta y número de una factura externa', async () => {
  const row = {
    id: 'entry-3',
    version: 4,
    plate: 'ABC123',
    invoice: { status: 'pending' },
    invoiceState: 'pending',
    manuallyInvoiced: false,
    manualInvoiceType: 'B',
    manualInvoicePointOfSale: '7',
    manualInvoiceNumber: '42',
  } as EntryHistoryRow;
  vi.mocked(setEntryExternalInvoice).mockResolvedValue({
    ...row,
    manuallyInvoiced: true,
  });
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <InvoiceDetail
          row={row}
          tenantId="tenant-1"
          arca="linked"
          emitter="monotributo"
          paymentModeAllowed
          onChanged={vi.fn()}
        />
      </QueryClientProvider>,
    );
  });
  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === label,
    );
  act(() => button('Registrar factura externa')!.click());
  expect(container.textContent).toContain('Punto de venta');
  await act(async () => {
    button('Guardar factura externa')!.click();
    await Promise.resolve();
  });
  expect(setEntryExternalInvoice).toHaveBeenCalledWith('tenant-1', row, {
    manualInvoiceType: 'B',
    manualInvoicePointOfSale: '7',
    manualInvoiceNumber: '42',
  });
});
