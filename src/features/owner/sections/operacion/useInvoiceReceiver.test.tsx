// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoiceReceiver } from './useInvoiceReceiver';
import { InvoiceReceiverChooser } from './InvoiceReceiverChooser';

const mock = vi.hoisted(() => ({
  suggestion: vi.fn(),
  lookup: vi.fn(),
  list: vi.fn(),
  clients: vi.fn(),
  entries: vi.fn(),
  invoices: vi.fn(),
}));
vi.mock('../../services/invoices', () => ({
  getInvoiceReceiverSuggestion: mock.suggestion,
  lookupTaxpayer: mock.lookup,
  listInvoiceReceivers: mock.list,
  listInvoices: mock.invoices,
}));
vi.mock('../../services/clients', () => ({ listClients: mock.clients }));
vi.mock('../../services/operations', () => ({ listEntries: mock.entries }));
const CUIT = '20427205208';
const MANUAL_CUIT = '30712345671';
type Input = Parameters<typeof useInvoiceReceiver>[0];
let input: Input;
let receiver: ReturnType<typeof useInvoiceReceiver>;
let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
async function update(callback: () => void) {
  await act(async () => {
    callback();
    await Promise.resolve();
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Harness({ value }: { value: Input }) {
  receiver = useInvoiceReceiver(value);
  return <InvoiceReceiverChooser receiver={receiver} emitter="monotributo" />;
}
async function render(patch: Partial<Input> = {}) {
  input = { ...input, ...patch };
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness value={input} />
      </QueryClientProvider>,
    );
    await vi.advanceTimersByTimeAsync(0);
  });
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.resetAllMocks();
  mock.suggestion.mockResolvedValue({ cuit: null });
  mock.list.mockResolvedValue([]);
  mock.clients.mockResolvedValue([]);
  mock.entries.mockResolvedValue([]);
  mock.invoices.mockResolvedValue([]);
  mock.lookup.mockResolvedValue({
    identified: true,
    razonSocial: 'Cliente',
    condicionIva: 'monotributo',
  });
  input = { tenantId: 'tenant', entryId: 'entry', suggestionEnabled: true };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await update(() => root.unmount());
  client.clear();
  container.remove();
  vi.useRealTimers();
});

describe('useInvoiceReceiver: pagador QR', () => {
  it('sugiere el CUIT de la ficha de la patente cuando el QR no trae uno', async () => {
    input.plate = 'IAG574';
    mock.clients.mockResolvedValue([
      { plates: ['IAG574'], cuit: CUIT, deletedAt: null },
    ]);
    await render();
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(receiver.choice).toBe('cuit');
    expect(receiver.cuit).toBe(CUIT);
  });
  it('completa el CUIT de la ficha aunque se elija Con CUIT antes de recibirla', async () => {
    input.plate = 'IAG574';
    const clients =
      deferred<{ plates: string[]; cuit: string; deletedAt: null }[]>();
    mock.clients.mockReturnValue(clients.promise);
    await render();
    await update(() => receiver.setChoice('cuit'));
    expect(receiver.cuit).toBe('');
    await update(() =>
      clients.resolve([{ plates: ['IAG574'], cuit: CUIT, deletedAt: null }]),
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(receiver.cuit).toBe(CUIT);
  });
  it('no revive el historial si la ficha tiene CUIT vacío', async () => {
    input.plate = 'IAG574';
    mock.clients.mockResolvedValue([
      { plates: ['IAG574'], cuit: null, deletedAt: null },
    ]);
    await render();
    expect(receiver.choice).toBe('final');
    expect(mock.invoices).not.toHaveBeenCalled();
  });

  it('usa la última factura con CUIT como respaldo si no hay ficha', async () => {
    input.plate = 'IAG574';
    mock.entries.mockResolvedValue([
      { id: 'old', tenantId: 'tenant', plate: 'IAG574' },
    ]);
    mock.invoices.mockResolvedValue([
      {
        tenantId: 'tenant',
        entryId: 'old',
        status: 'issued',
        receptorDocTipo: 80,
        receptorDocNro: CUIT,
        issuedAt: '2026-10-07T12:00:00Z',
        updatedAt: '2026-10-07T12:00:00Z',
      },
    ]);
    await render();
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(receiver.choice).toBe('cuit');
    expect(receiver.cuit).toBe(CUIT);
  });
  it('selecciona Con CUIT y muestra Mercado Pago sin saltarse el padron', async () => {
    mock.suggestion.mockResolvedValue({ cuit: CUIT });
    await render();
    expect(receiver.choice).toBe('cuit');
    expect(receiver.cuit).toBe(CUIT);
    expect(receiver.source).toBe('mercadopago');
    expect(container.textContent).toContain('Mercado Pago');
    expect(receiver.ready).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(mock.lookup).toHaveBeenCalledWith('tenant', CUIT, undefined);
    expect(receiver.cuitToSend).toBe(CUIT);
    expect(receiver.ready).toBe(true);
  });

  it('permite elegir consumidor final mientras resuelve y conserva la eleccion', async () => {
    const suggestion = deferred<{ cuit: string }>();
    mock.suggestion.mockReturnValue(suggestion.promise);
    await render();
    expect(receiver.ready).toBe(false);
    await update(() => receiver.setChoice('final'));
    expect(receiver.ready).toBe(true);
    await update(() => suggestion.resolve({ cuit: CUIT }));
    expect(receiver.choice).toBe('final');
    expect(receiver.cuit).toBe('');
  });

  it('no pisa el CUIT manual y borra la indicacion de origen al editar', async () => {
    const suggestion = deferred<{ cuit: string }>();
    mock.suggestion.mockReturnValue(suggestion.promise);
    await render();
    await update(() => {
      receiver.setChoice('cuit');
      receiver.setCuit(MANUAL_CUIT);
    });
    await update(() => suggestion.resolve({ cuit: CUIT }));
    expect(receiver.cuit).toBe(MANUAL_CUIT);
    expect(receiver.source).toBe(null);
  });

  it('permite modificar el CUIT autocompletado y volver a consumidor final', async () => {
    mock.suggestion.mockResolvedValue({ cuit: CUIT });
    await render();
    await update(() => receiver.setCuit(MANUAL_CUIT));
    expect(receiver.source).toBe(null);
    expect(receiver.cuit).toBe(MANUAL_CUIT);
    await update(() => receiver.setChoice('final'));
    expect(receiver.cuitToSend).toBeUndefined();
  });

  it('no consulta si no esta abierto el selector', async () => {
    await render({ suggestionEnabled: false });
    expect(mock.suggestion).not.toHaveBeenCalled();
  });

  it('limita la espera a cinco segundos y descarta el resultado tardio sin reintentar', async () => {
    const suggestion = deferred<{ cuit: string }>();
    mock.suggestion.mockReturnValue(suggestion.promise);
    await render();
    const signal = mock.suggestion.mock.calls[0][2] as AbortSignal;
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(receiver.ready).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(receiver.ready).toBe(true);
    expect(signal.aborted).toBe(true);
    await update(() => suggestion.resolve({ cuit: CUIT }));
    await render();
    expect(receiver.choice).toBe('final');
    expect(mock.suggestion).toHaveBeenCalledTimes(1);
  });

  it.each([null, '20427205209'])(
    'sin CUIT valido permite consumidor final: %s',
    async (cuit) => {
      mock.suggestion.mockResolvedValue({ cuit });
      await render();
      expect(receiver.choice).toBe('final');
      expect(receiver.ready).toBe(true);
    },
  );

  it('fallo del proveedor permite seguir sin reintentos', async () => {
    mock.suggestion.mockRejectedValue(new Error('unreachable'));
    await render();
    expect(receiver.ready).toBe(true);
    await render();
    expect(mock.suggestion).toHaveBeenCalledTimes(1);
  });

  it('descarta respuestas de un ingreso o estacionamiento anterior', async () => {
    const first = deferred<{ cuit: string }>();
    mock.suggestion
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ cuit: MANUAL_CUIT });
    await render();
    await render({ tenantId: 'other', entryId: 'other' });
    await update(() => first.resolve({ cuit: CUIT }));
    expect(receiver.cuit).toBe(MANUAL_CUIT);
  });

  it('cancelar y reabrir no aplica datos de la apertura cancelada', async () => {
    const first = deferred<{ cuit: string }>();
    mock.suggestion
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ cuit: MANUAL_CUIT });
    await render();
    await render({ suggestionEnabled: false });
    await render({ suggestionEnabled: true });
    await update(() => first.resolve({ cuit: CUIT }));
    expect(receiver.cuit).toBe(MANUAL_CUIT);
  });

  it('mantiene congelado el receptor durante la confirmacion', async () => {
    const suggestion = deferred<{ cuit: string }>();
    mock.suggestion.mockReturnValue(suggestion.promise);
    await render();
    await render({ frozen: true });
    await update(() => suggestion.resolve({ cuit: CUIT }));
    expect(receiver.choice).toBe('final');
  });

  it('conserva el comportamiento ante fallo del padron', async () => {
    mock.suggestion.mockResolvedValue({ cuit: CUIT });
    mock.lookup.mockRejectedValue(new Error('padron unavailable'));
    await render();
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(receiver.lookup.status).toBe('error');
    expect(receiver.ready).toBe(true);
    expect(receiver.cuitToSend).toBe(CUIT);
  });
});
