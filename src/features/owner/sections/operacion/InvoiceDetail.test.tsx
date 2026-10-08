// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvoiceDetail } from './InvoiceDetail';
import type { EntryHistoryRow } from './operationUtils';

vi.mock('../../../../lib/notifications/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../services/invoices', () => ({
  getInvoiceDocument: vi.fn(),
  setEntryManualInvoiceNumber: vi.fn(),
  setEntryManuallyInvoiced: vi.fn(),
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
      <InvoiceDetail
        row={row}
        tenantId="tenant-1"
        arca="none"
        emitter={null}
        onChanged={vi.fn()}
      />,
    );
  });

  expect(container.textContent).toContain('Facturada a mano');
  expect(
    container.querySelector<HTMLInputElement>(
      'input[id^="manual-invoice-number-"]',
    )?.value,
  ).toBe('0001-00000042');
  expect(
    container.querySelector('[aria-label="Guardar número de factura"]'),
  ).not.toBeNull();
});
