// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InvoiceDetail } from './InvoiceDetail';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EntryHistoryRow } from './operationUtils';
import { setEntryExternalInvoice } from '../../services/invoices';
import { correctEntry } from '../../services/operations';
vi.mock('../../hooks/useArcaAccount', () => ({
  useArcaAccounts: () => ({
    data: [
      {
        id: 'primary',
        role: 'primary',
        status: 'linked',
        condicionIva: 'monotributo',
        cuit: '20123456786',
        ptoVta: 7,
      },
    ],
  }),
}));

vi.mock('../../../../lib/notifications/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../services/invoices', () => ({
  getInvoiceDocument: vi.fn(),
  setEntryManualInvoiceNumber: vi.fn(),
  setEntryManuallyInvoiced: vi.fn(),
  setEntryExternalInvoice: vi.fn(),
}));
vi.mock('../../services/operations', () => ({
  correctEntry: vi.fn(),
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
          canManage
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
    manualInvoiceArcaAccountId: 'primary',
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
          canManage
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
    manualInvoiceArcaAccountId: 'primary',
  });
});

it.each(['nombre', 'cuit'])(
  'registra una externa con %s de otro emisor y sin cuenta vinculada',
  async (field) => {
    const row = {
      id: 'external-third',
      version: 4,
      plate: 'ABC123',
      invoice: { status: 'pending' },
      invoiceState: 'pending',
      manuallyInvoiced: false,
      manualInvoiceType: 'C',
      manualInvoicePointOfSale: '12',
      manualInvoiceNumber: '123',
    } as EntryHistoryRow;
    const issuer =
      field === 'nombre'
        ? {
            manualInvoiceIssuerName: 'Emisor tercero',
            manualInvoiceIssuerCuit: null,
          }
        : {
            manualInvoiceIssuerName: null,
            manualInvoiceIssuerCuit: '20123456786',
          };
    vi.mocked(setEntryExternalInvoice).mockResolvedValue({
      ...row,
      manuallyInvoiced: true,
      ...issuer,
    });
    act(() =>
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <InvoiceDetail
            row={row}
            tenantId="tenant-1"
            arca="linked"
            emitter="monotributo"
            paymentModeAllowed
            canManage
            onChanged={vi.fn()}
          />
        </QueryClientProvider>,
      ),
    );
    const button = (label: string) =>
      [...container.querySelectorAll('button')].find(
        (item) => item.textContent === label,
      )!;
    act(() => button('Registrar factura externa').click());
    expect(container.querySelector('.operation-invoice-account')).toBeNull();
    act(() =>
      container
        .querySelector<HTMLInputElement>(
          '.operation-external-issuer-toggle input',
        )!
        .click(),
    );
    expect(button('Guardar factura externa').disabled).toBe(true);
    const input = [
      ...container.querySelectorAll('.operation-external-issuer-fields label'),
    ]
      .find((label) =>
        label.textContent?.includes(field === 'nombre' ? 'Nombre' : 'CUIT'),
      )!
      .querySelector('input')!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(
        input,
        field === 'nombre' ? ' Emisor tercero ' : '20-12345678-6',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(button('Guardar factura externa').disabled).toBe(false);
    await act(async () => {
      button('Guardar factura externa').click();
      await Promise.resolve();
    });
    expect(setEntryExternalInvoice).toHaveBeenCalledWith('tenant-1', row, {
      manualInvoiceType: 'C',
      manualInvoicePointOfSale: '12',
      manualInvoiceNumber: '123',
      manualInvoiceArcaAccountId: null,
      ...issuer,
    });
  },
);

it('el dueño puede alternar Pendiente y No facturado, también sin ARCA', async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const row = {
    id: 'entry-4',
    version: 5,
    plate: 'ABC123',
    leftAt: '2026-10-10T10:00:00Z',
    paidTotal: 5000,
    invoice: null,
    invoiceState: 'none',
    manuallyInvoiced: false,
  } as EntryHistoryRow;
  vi.mocked(correctEntry).mockResolvedValue(row);
  const renderRow = (current: EntryHistoryRow) =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <InvoiceDetail
          row={current}
          tenantId="tenant-1"
          arca="none"
          emitter={null}
          paymentModeAllowed={false}
          canManage
          onChanged={onChanged}
        />
      </QueryClientProvider>,
    );

  act(() => renderRow(row));
  const reminder = container.querySelector('.operation-invoice-reminder')!;
  expect(reminder).toBeTruthy();
  const pendingButton = [...reminder.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Pendiente',
  )!;
  await act(async () => {
    pendingButton.click();
    await Promise.resolve();
  });
  expect(correctEntry).toHaveBeenCalledWith('tenant-1', row, {
    invoicePending: true,
  });
  expect(onChanged).toHaveBeenCalledOnce();

  const pendingRow = {
    ...row,
    version: 6,
    invoiceState: 'pending' as const,
    invoice: { status: 'pending' } as EntryHistoryRow['invoice'],
  };
  act(() => renderRow(pendingRow));
  const noInvoiceButton = [...reminder.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'No facturado',
  )!;
  await act(async () => {
    noInvoiceButton.click();
    await Promise.resolve();
  });
  expect(correctEntry).toHaveBeenLastCalledWith('tenant-1', pendingRow, {
    invoicePending: false,
  });
});

it('oculta el seguimiento a no dueños y en facturas ya emitidas', () => {
  const row = {
    id: 'entry-5',
    version: 1,
    plate: 'ABC123',
    leftAt: '2026-10-10T10:00:00Z',
    paidTotal: 5000,
    invoiceState: 'pending',
    invoice: { status: 'pending' },
  } as EntryHistoryRow;
  const renderRow = (canManage: boolean, invoiceState = row.invoiceState) =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <InvoiceDetail
          row={{ ...row, invoiceState }}
          tenantId="tenant-1"
          arca="linked"
          emitter={null}
          paymentModeAllowed
          canManage={canManage}
          onChanged={vi.fn()}
        />
      </QueryClientProvider>,
    );
  act(() => renderRow(false));
  expect(container.querySelector('.operation-invoice-reminder')).toBeNull();
  act(() => renderRow(true, 'issued'));
  expect(container.querySelector('.operation-invoice-reminder')).toBeNull();
});
