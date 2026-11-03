// @vitest-environment happy-dom
import { templateServer } from '../../test/templateServer';
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mount,
  unmountAll,
  click,
  change,
  field,
  button,
  settle,
} from '../../test/dom';
import { TemplateSelector } from './TemplateSelector';
import { TableViewConfigSchema } from './definitions';
import { saveTableTemplate, readTableTemplateCollection } from './storage';

const scope = { userId: 'user', tenantId: 'tenant', tableKey: 'history' };
const config = TableViewConfigSchema.parse({
  globalSearch: '#66',
  globalSearchMode: 'ticket',
});
const onApply = vi.fn();
function Harness() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <TemplateSelector
      scope={scope}
      selectedTemplateId={selected}
      onSelectedTemplateIdChange={setSelected}
      getCurrentConfig={() => config}
      onApply={onApply}
    />
  );
}
function network(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}
beforeEach(() => {
  localStorage.clear();
  onApply.mockClear();
  network(true);
});
afterEach(async () => {
  await unmountAll();
  network(true);
});
describe('selector web sincronizable', () => {
  it('allows applying cached views offline but disables all writes', async () => {
    saveTableTemplate(scope, { name: 'Cacheada', config });
    network(false);
    await mount(<Harness />);
    await click('Plantillas');
    expect((button('Guardar plantilla') as HTMLButtonElement).disabled).toBe(
      true,
    );
    await click('Cacheada');
    expect(onApply).toHaveBeenCalledWith(config);
    await click('Plantillas');
    expect((button('Actualizar actual') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (
        document.querySelector(
          '[title="Eliminar plantilla"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(templateServer.rows.size).toBe(0);
  });
  it('keeps the form and reports a translated error when saving fails, then retries', async () => {
    await mount(<Harness />);
    await click('Plantillas');
    await click('Guardar plantilla');
    await change(field('Nombre'), 'Mi plantilla');
    templateServer.failBeforeSave = true;
    await click('Guardar');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field('Nombre').value).toBe('Mi plantilla');
    expect(
      document.querySelector('[role="dialog"] [role="alert"]')?.textContent,
    ).not.toContain('server unavailable');
    expect(readTableTemplateCollection(scope).templates).toEqual([]);
    templateServer.failBeforeSave = false;
    await click('Guardar');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(templateServer.rows.size).toBe(1);
  });
  it('refreshes without applying a remote template or changing the active filters', async () => {
    await mount(<Harness />);
    templateServer.rows.set(
      JSON.stringify(['user', 'web', 'tenant', 'history']) + ':remote',
      {
        id: 'remote',
        name: 'Otra PC',
        config,
        createdAt: '2026-11-03T00:00:00.000Z',
        updatedAt: '2026-11-03T00:00:00.000Z',
        deletedAt: null,
      },
    );
    await act(() => {
      window.dispatchEvent(new Event('focus'));
      return Promise.resolve();
    });
    await settle();
    await click('Plantillas');
    expect(button('Otra PC')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });
});
