/**
 * Helpers para tests de pantallas con happy-dom, sin Testing Library: montan
 * con `createRoot` dentro de `act`, como `CajaPage.test.tsx`.
 *
 * El archivo de test tiene que declarar `// @vitest-environment happy-dom`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect } from 'vitest';
import { ToastProvider } from '../lib/notifications/ToastProvider';

export type Mounted = {
  container: HTMLDivElement;
  client: QueryClient;
  unmount: () => Promise<void>;
};

let mounted: Mounted[] = [];

/** Monta `ui` con React Query, toasts y un router en `path`. */
export async function mount(
  ui: ReactNode,
  { path = '/' }: { path?: string } = {},
): Promise<Mounted> {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(() =>
    Promise.resolve(
      root.render(
        <QueryClientProvider client={client}>
          <ToastProvider>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>,
      ),
    ),
  );
  await settle();
  const handle: Mounted = {
    container,
    client,
    unmount: async () => {
      await act(() => Promise.resolve(root.unmount()));
      client.clear();
      container.remove();
    },
  };
  mounted.push(handle);
  return handle;
}

/** Desmonta todo lo montado en el test (para `afterEach`). */
export async function unmountAll(): Promise<void> {
  for (const handle of mounted) await handle.unmount();
  mounted = [];
  document.body.innerHTML = '';
}

/** Deja correr promesas y timers en cero (queries, mutaciones, efectos). */
export async function settle(rounds = 5): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  }
}

function text(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Botón (o link) cuyo texto o `aria-label` coincide. */
export function button(
  label: string | RegExp,
  host: ParentNode = document.body,
): HTMLElement {
  const match = (value: string | null | undefined) =>
    value != null &&
    (typeof label === 'string' ? value === label : label.test(value));
  const found = [
    ...host.querySelectorAll<HTMLElement>('button, a, [role="button"]'),
  ].find(
    (element) =>
      match(text(element)) || match(element.getAttribute('aria-label')),
  );
  expect(found, `botón "${String(label)}"`).toBeTruthy();
  return found!;
}

export async function click(
  target: HTMLElement | string | RegExp,
  host: ParentNode = document.body,
): Promise<void> {
  const element =
    typeof target === 'string' || target instanceof RegExp
      ? button(target, host)
      : target;
  await act(() => Promise.resolve(element.click()));
  await settle();
}

/** Cambia el valor de un input/textarea/select como lo haría el usuario. */
export async function change(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): Promise<void> {
  // El setter del prototipo, no el de la instancia: React lo intercepta para
  // saber que el valor cambió y disparar su onChange.
  const prototype = Object.getPrototypeOf(element) as object;
  await act(() => {
    Reflect.set(prototype, 'value', value, element);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return Promise.resolve();
  });
  await settle();
}

/** Input por `aria-label`, `placeholder` o el texto de su `<label>`. */
export function field<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =
    HTMLInputElement,
>(label: string, host: ParentNode = document.body): T {
  const byAttribute = host.querySelector<T>(
    `[aria-label="${label}"], [placeholder="${label}"]`,
  );
  if (byAttribute) return byAttribute;
  const labelElement = [...host.querySelectorAll('label')].find((element) =>
    text(element).startsWith(label),
  );
  const control =
    (labelElement?.htmlFor &&
      host.querySelector<T>(`#${CSS.escape(labelElement.htmlFor)}`)) ||
    labelElement?.querySelector<T>('input, textarea, select');
  expect(control, `campo "${label}"`).toBeTruthy();
  return control as T;
}

/** Texto visible de toda la página. */
export function pageText(): string {
  return text(document.body);
}

/**
 * Espera a que la página muestre `expected` (queries con reintentos propios,
 * timers). Falla con el texto actual si no aparece a tiempo.
 */
export async function waitForText(
  expected: string,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!pageText().includes(expected) && Date.now() < deadline) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
  }
  expect(pageText()).toContain(expected);
}
