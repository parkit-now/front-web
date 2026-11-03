// @vitest-environment happy-dom
import { templateServer } from '../../test/templateServer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  refreshRemoteTemplates,
  saveRemoteTemplate,
  deleteRemoteTemplate,
} from './repository';
import { readTableTemplateCollection, saveTableTemplate } from './storage';
import { TableViewConfigSchema } from './definitions';
import { putTableTemplate } from '../../lib/api/table-templates';

const scope = { userId: 'user', tenantId: 'tenant', tableKey: 'history' };
const input = {
  name: 'Diaria',
  config: TableViewConfigSchema.parse({
    globalSearch: '#66',
    globalSearchMode: 'ticket',
  }),
};
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
describe('plantillas web sincronizadas', () => {
  it('makes saved views available on a second browser, without syncing local selection', async () => {
    await saveRemoteTemplate(scope, input, 'id');
    localStorage.clear();
    const otherPC = await refreshRemoteTemplates(scope);
    expect(otherPC.templates[0]).toMatchObject({
      id: 'id',
      name: 'Diaria',
      config: { globalSearchMode: 'ticket' },
    });
    expect(otherPC.lastUsedTemplateId).toBeNull();
  });
  it('separates users, platforms, parking lots and tables', async () => {
    await saveRemoteTemplate(scope, input, 'id');
    expect(
      (await refreshRemoteTemplates({ ...scope, tenantId: 'other' })).templates,
    ).toEqual([]);
    expect(
      (await refreshRemoteTemplates({ ...scope, tableKey: 'clients' }))
        .templates,
    ).toEqual([]);
    templateServer.userId = 'another';
    expect(
      (await refreshRemoteTemplates({ ...scope, userId: 'another' })).templates,
    ).toEqual([]);
    expect(
      [...templateServer.rows.keys()].every((k) => k.includes('web')),
    ).toBe(true);
    await expect(saveRemoteTemplate(scope, input, 'id')).rejects.toThrow(
      'Session changed',
    );
  });
  it('imports legacy views once and never replaces a newer remote view', async () => {
    const legacy = saveTableTemplate(scope, input)!;
    await refreshRemoteTemplates(scope);
    await saveRemoteTemplate(scope, { ...input, name: 'Nueva' }, legacy.id);
    localStorage.clear();
    // Another PC still has an old local copy with the same id.
    const old = { ...legacy, name: 'Vieja' };
    const key = 'parkit.web.table-views:user:tenant:history';
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        templates: [old],
        lastUsedTemplateId: old.id,
      }),
    );
    expect((await refreshRemoteTemplates(scope)).templates[0].name).toBe(
      'Nueva',
    );
    const count = vi.mocked(putTableTemplate).mock.calls.length;
    await refreshRemoteTemplates(scope);
    expect(vi.mocked(putTableTemplate).mock.calls.length).toBe(count);
  });
  it('never resurrects deleted views from another PC cache', async () => {
    const legacy = saveTableTemplate(scope, input)!;
    await refreshRemoteTemplates(scope);
    await deleteRemoteTemplate(scope, legacy.id);
    localStorage.clear();
    localStorage.setItem(
      'parkit.web.table-views:user:tenant:history',
      JSON.stringify({
        version: 1,
        templates: [legacy],
        lastUsedTemplateId: legacy.id,
      }),
    );
    expect((await refreshRemoteTemplates(scope)).templates).toEqual([]);
    expect(readTableTemplateCollection(scope).lastUsedTemplateId).toBeNull();
  });
  it('does not pretend a failed save succeeded and reuses a lost-response mutation id', async () => {
    await refreshRemoteTemplates(scope);
    templateServer.failAfterSave = true;
    await expect(saveRemoteTemplate(scope, input, 'id')).rejects.toThrow();
    expect(readTableTemplateCollection(scope).templates).toEqual([]);
    await saveRemoteTemplate(scope, input, 'id');
    const calls = vi.mocked(putTableTemplate).mock.calls.filter((c) => !c[5]);
    expect(calls[0][4].mutationId).toBe(calls[1][4].mutationId);
    expect(templateServer.rows.size).toBe(1);
  });
  it('does not replay an older write after another device has updated the view', async () => {
    await refreshRemoteTemplates(scope);
    templateServer.failAfterSave = true;
    await expect(saveRemoteTemplate(scope, input, 'id')).rejects.toThrow();
    await putTableTemplate(scope, 'web', 'token-other-pc', 'id', {
      ...input,
      name: 'Nueva desde otra PC',
      mutationId: crypto.randomUUID(),
    });
    expect((await saveRemoteTemplate(scope, input, 'id'))?.name).toBe(
      'Nueva desde otra PC',
    );
  });
});
