// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { correctEntry } from '../../services/operations';
import { EntryNotesEditor } from './EntryNotesEditor';

const toast = vi.fn();
vi.mock('../../../../lib/notifications/ToastProvider', () => ({
  useToast: () => ({ showToast: toast }),
}));
vi.mock('../../services/operations', () => ({ correctEntry: vi.fn() }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => Promise.resolve(root.unmount()));
  container.remove();
});

async function click(label: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>('button'),
  ].find((item) => item.textContent?.trim() === label)!;
  expect(button).toBeTruthy();
  await act(() => Promise.resolve(button.click()));
}

it('el dueño guarda y quita notas en una estadía cerrada', async () => {
  const entry = { id: 'entry', version: 4, notes: 'Nota anterior' };
  const onChanged = vi.fn().mockResolvedValue(undefined);
  vi.mocked(correctEntry).mockResolvedValue(entry as never);
  await act(() =>
    Promise.resolve(
      root.render(
        <EntryNotesEditor
          entry={entry}
          tenantId="tenant"
          canEdit
          onChanged={onChanged}
        />,
      ),
    ),
  );
  await click('Editar');
  const textarea = container.querySelector('textarea')!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(textarea, '  Nota nueva  ');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Guardar notas');
  expect(correctEntry).toHaveBeenCalledWith('tenant', entry, {
    notes: 'Nota nueva',
  });
  expect(onChanged).toHaveBeenCalledOnce();
});

it('no permite editar notas si no es dueño', async () => {
  await act(() =>
    Promise.resolve(
      root.render(
        <EntryNotesEditor
          entry={{ id: 'entry', version: 1, notes: 'Visible' }}
          tenantId="tenant"
          canEdit={false}
          onChanged={vi.fn()}
        />,
      ),
    ),
  );
  expect(container.textContent).toContain('Visible');
  expect(container.querySelector('button')).toBeNull();
});

it('puede borrar una nota guardada', async () => {
  const entry = { id: 'entry', version: 5, notes: 'Quitar esta nota' };
  vi.mocked(correctEntry).mockResolvedValue(entry as never);
  await act(() =>
    Promise.resolve(
      root.render(
        <EntryNotesEditor
          entry={entry}
          tenantId="tenant"
          canEdit
          onChanged={vi.fn()}
        />,
      ),
    ),
  );
  await click('Editar');
  const textarea = container.querySelector('textarea')!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(textarea, '');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Guardar notas');
  expect(correctEntry).toHaveBeenCalledWith('tenant', entry, { notes: '' });
});
