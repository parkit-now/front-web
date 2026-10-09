// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CajaPage } from './CajaPage';
import { ToastProvider } from '../../../../lib/notifications/ToastProvider';
import { saveTableTemplate } from '../../../../features/table-view-template';

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({ sucursalId: 'tenant', sucursal: { nombre: 'APEX' } }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user',
}));
vi.mock('../../hooks/useArcaAccount', () => ({
  useArcaAccount: () => ({ data: null }),
}));
vi.mock('../../services/operations', () => ({
  listEntries: vi.fn(),
  listPaymentTransactions: vi.fn(),
}));
vi.mock('../../services/cash-sessions', () => ({
  listAllCashSessions: vi.fn(),
}));
vi.mock('../../services/invoices', () => ({
  listInvoices: vi.fn(),
  issueInvoiceBatch: vi.fn(),
}));
vi.mock('../../services/lpr-events', () => ({
  getLprDetectionEventImageUrl: vi.fn(),
  listRegisteredLprDetectionEventsForEntries: () => Promise.resolve([]),
}));
vi.mock('./InvoiceDetail', () => ({
  InvoiceDetail: () => <span>Factura del movimiento</span>,
}));

const date = '2026-10-07T10:00:00Z';
const common = { tenantId: 'tenant', updatedAt: date, version: 1, syncSeq: 1 };
const sessions = [
  { ...common, id: 'active', openedAt: date, openingCash: 0 },
  {
    ...common,
    id: 'closed',
    openedAt: '2026-10-06T10:00:00Z',
    closedAt: date,
    openingCash: 0,
    closingCash: 10,
    notes: 'caja anterior',
  },
];
const entries = [
  {
    ...common,
    id: 'a',
    plate: 'ACT123',
    cashSessionId: 'active',
    enteredAt: date,
    source: 'manual',
    manuallyInvoiced: false,
  },
  {
    ...common,
    id: 'b',
    plate: 'OLD123',
    cashSessionId: 'closed',
    enteredAt: date,
    leftAt: date,
    amountPaid: 10,
    source: 'manual',
    manuallyInvoiced: false,
  },
];
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
function LocationProbe() {
  return <output data-path>{useLocation().pathname}</output>;
}
async function click(text: string, host: Element = container) {
  const button = [...host.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text,
  )!;
  expect(button).toBeTruthy();
  await act(() => Promise.resolve(button.click()));
}
function historyRows() {
  return [
    ...container.querySelectorAll('.cash-session-movements-table tbody tr'),
  ].map((row) => row.textContent);
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const [key, value] of Object.entries({
    entries,
    'cash-sessions': sessions,
    'payment-transactions': [],
    'payment-methods': [],
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
async function render() {
  await act(() =>
    Promise.resolve(
      root.render(
        <QueryClientProvider client={client}>
          <ToastProvider>
            <MemoryRouter
              initialEntries={['/ops/estacionamientos/tenant/caja']}
            >
              <CajaPage />
              <LocationProbe />
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>,
      ),
    ),
  );
}
async function openClosed() {
  await act(() =>
    Promise.resolve(
      container.querySelector<HTMLTableRowElement>('tbody tr')!.click(),
    ),
  );
  const drawer = container.querySelector('[aria-label="Detalle de caja"]')!;
  expect(drawer).toBeTruthy();
  await click('Ver movimientos', drawer);
}

describe('movimientos de caja sin navegar al historial', () => {
  it('abre la caja activa con sus movimientos y conserva la ruta al cerrar', async () => {
    await render();
    const trigger = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Ver movimientos',
    )!;
    trigger.focus();
    await click('Ver movimientos');
    expect(historyRows()).toHaveLength(1);
    expect(historyRows()[0]).toContain('ACT123');
    expect(container.querySelector('[data-path]')!.textContent).toBe(
      '/ops/estacionamientos/tenant/caja',
    );
    expect(container.querySelector('button[title*="Excel"]')).toBeTruthy();
    await act(() =>
      Promise.resolve(
        container
          .querySelector<HTMLButtonElement>(
            '[aria-label="Movimientos de caja"] [aria-label="Cerrar"]',
          )!
          .click(),
      ),
    );
    expect(
      container.querySelector('[aria-label="Movimientos de caja"]'),
    ).toBeNull();
    expect(container.textContent).toContain('Ver movimientos');
    expect(document.activeElement).toBe(trigger);
  });
  it('abre una caja cerrada y da prioridad a esa caja sobre la vista guardada', async () => {
    saveTableTemplate(
      {
        userId: 'user',
        tenantId: 'tenant',
        tableKey: 'owner-cash-session-movements',
      },
      {
        name: 'Otra caja',
        config: {
          version: 1,
          columns: { visibility: {}, order: [], pinnedLeft: [] },
          filters: [{ id: 'cashSessionId', value: ['active'] }],
          globalSearch: 'ACT123',
          sorting: [],
          pagination: { pageSize: 20 },
        },
      },
    );
    await render();
    await openClosed();
    expect(
      container.querySelector('[aria-label="Detalle de caja"]'),
    ).toBeTruthy();
    expect(historyRows()).toHaveLength(1);
    expect(historyRows()[0]).toContain('OLD123');
    expect(container.querySelector('[data-path]')!.textContent).toBe(
      '/ops/estacionamientos/tenant/caja',
    );
    expect(
      [...Array(localStorage.length).keys()]
        .map((index) => localStorage.key(index))
        .join(),
    ).not.toContain('owner-history');
  });
  it('no cierra el historial al interactuar con un dialogo de plantillas', async () => {
    await render();
    await openClosed();
    const history = container.querySelector(
      '[aria-label="Movimientos de caja"]',
    )!;
    await act(() =>
      Promise.resolve(
        history
          .querySelector<HTMLButtonElement>('[title="Plantillas de tabla"]')!
          .click(),
      ),
    );
    await click('Guardar plantilla', history);
    const saveDialog = container.querySelector(
      '[aria-label="Guardar plantilla"]',
    )!;
    expect(saveDialog).toBeTruthy();
    await act(() =>
      Promise.resolve(
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      ),
    );
    expect(
      container.querySelector('[aria-label="Movimientos de caja"]'),
    ).toBeTruthy();
    await act(() =>
      Promise.resolve(
        saveDialog
          .querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!
          .click(),
      ),
    );
    expect(
      container.querySelector('[aria-label="Guardar plantilla"]'),
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Movimientos de caja"]'),
    ).toBeTruthy();
  });
  it('mantiene abierto el historial cuando Escape cierra el detalle del movimiento', async () => {
    await render();
    await openClosed();
    await act(() =>
      Promise.resolve(
        container
          .querySelector<HTMLTableRowElement>(
            '.cash-session-movements-table tbody tr',
          )!
          .click(),
      ),
    );
    expect(
      container.querySelector('[aria-label="Detalle de movimiento"]'),
    ).toBeTruthy();
    await act(() =>
      Promise.resolve(
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      ),
    );
    expect(
      container.querySelector('[aria-label="Detalle de movimiento"]'),
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Movimientos de caja"]'),
    ).toBeTruthy();
    await act(() =>
      Promise.resolve(
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      ),
    );
    expect(
      container.querySelector('[aria-label="Movimientos de caja"]'),
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Detalle de caja"]'),
    ).toBeTruthy();
    expect(
      container
        .querySelector('[aria-label="Detalle de caja"]')!
        .closest('[inert]'),
    ).toBeNull();
  });
  it('conserva el detalle de caja al cerrar movimientos con el boton o Escape', async () => {
    await render();
    await openClosed();
    const detail = container.querySelector('[aria-label="Detalle de caja"]')!;
    expect(detail.closest('[inert]')).toBeTruthy();
    expect((detail.parentElement as HTMLElement).style.zIndex).toBe('30');
    await act(() =>
      Promise.resolve(
        container
          .querySelector<HTMLButtonElement>(
            '[aria-label="Movimientos de caja"] [aria-label="Cerrar"]',
          )!
          .click(),
      ),
    );
    expect(container.querySelector('[aria-label="Detalle de caja"]')).toBe(
      detail,
    );
    expect(detail.closest('[inert]')).toBeNull();
    await click('Ver movimientos', detail);
    await act(() =>
      Promise.resolve(
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      ),
    );
    expect(
      container.querySelector('[aria-label="Movimientos de caja"]'),
    ).toBeNull();
    expect(container.querySelector('[aria-label="Detalle de caja"]')).toBe(
      detail,
    );
    expect(detail.closest('[inert]')).toBeNull();
    await act(() =>
      Promise.resolve(
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      ),
    );
    expect(
      container.querySelector('[aria-label="Detalle de caja"]'),
    ).toBeNull();
  });
});
