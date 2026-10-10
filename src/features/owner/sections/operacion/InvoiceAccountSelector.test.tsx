// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInvoiceAccountSelection } from './InvoiceAccountSelector';

vi.mock('../../hooks/useArcaAccount', () => ({
  useArcaAccounts: () => ({
    data: [
      { id: 'primary', role: 'primary' },
      { id: 'secondary', role: 'secondary' },
    ],
  }),
}));
let root: Root;
let container: HTMLDivElement;
let selection: ReturnType<typeof useInvoiceAccountSelection>;
function Harness({ id, previous }: { id: string; previous?: string }) {
  selection = useInvoiceAccountSelection('tenant', previous, id);
  return null;
}
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
it('cada movimiento nuevo empieza con primaria, sin persistir elecciones anteriores', () => {
  act(() => root.render(<Harness id="first" />));
  expect(selection.accountId).toBe('primary');
  act(() => selection.select('secondary'));
  expect(selection.accountId).toBe('secondary');
  act(() => root.render(<Harness id="second" />));
  expect(selection.accountId).toBe('primary');
});
it('un reintento abre con la cuenta anterior', () => {
  act(() => root.render(<Harness id="first" previous="secondary" />));
  expect(selection.accountId).toBe('secondary');
});
it('una cuenta que desaparece no se reemplaza silenciosamente por primaria', () => {
  act(() => root.render(<Harness id="first" previous="unlinked-account" />));
  expect(selection.accountId).toBe('unlinked-account');
  expect(selection.account).toBeUndefined();
});
