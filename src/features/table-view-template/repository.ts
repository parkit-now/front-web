import {
  listTableTemplates,
  putTableTemplate,
  removeTableTemplate,
  type SavedTableTemplateDto,
} from '../../lib/api/table-templates';
import { z } from 'zod';
import {
  TableViewTemplateSchema,
  type TableTemplateScope,
  type SaveTableTemplateInput,
} from './definitions';
import {
  buildTableTemplateStorageKey,
  readTableTemplateCollection,
  writeCollection,
} from './storage';

const locks = new Map<string, Promise<unknown>>();
export function inTemplateScope<T>(
  scope: TableTemplateScope,
  action: () => Promise<T>,
): Promise<T> {
  const key = buildTableTemplateStorageKey(scope);
  const job = (locks.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(action);
  locks.set(key, job);
  void job
    .finally(() => {
      if (locks.get(key) === job) locks.delete(key);
    })
    .catch(() => undefined);
  return job;
}
async function token(scope: TableTemplateScope): Promise<string> {
  const { supabase } = await import('../../lib/supabase/client');
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== scope.userId)
    throw new Error('Session changed');
  return data.session.access_token;
}
function cache(
  scope: TableTemplateScope,
  rows: SavedTableTemplateDto[],
  replace: boolean,
) {
  const collection = readTableTemplateCollection(scope);
  const templates = new Map(
    (replace ? [] : collection.templates).map((t) => [t.id, t]),
  );
  for (const row of rows) {
    if (row.deletedAt) templates.delete(row.id);
    else templates.set(row.id, TableViewTemplateSchema.parse(row));
  }
  writeCollection(scope, {
    version: 1,
    templates: [...templates.values()],
    lastUsedTemplateId:
      collection.lastUsedTemplateId &&
      templates.has(collection.lastUsedTemplateId)
        ? collection.lastUsedTemplateId
        : null,
  });
}
async function importLegacy(scope: TableTemplateScope, bearer: string) {
  const key = buildTableTemplateStorageKey(scope) + ':migration';
  let state: { done?: boolean; ids?: Record<string, string> } = {};
  try {
    state = z
      .object({
        done: z.boolean().optional(),
        ids: z.record(z.string(), z.string().uuid()).optional(),
      })
      .parse(JSON.parse(localStorage.getItem(key) ?? '{}'));
  } catch {
    /* Preserve the legacy cache and retry a fresh import. */
  }
  if (state.done) return;
  const legacy = readTableTemplateCollection(scope).templates;
  state.ids ??= {};
  for (const template of legacy) {
    const mutationId = state.ids[template.id] ?? crypto.randomUUID();
    state.ids[template.id] = mutationId;
    localStorage.setItem(key, JSON.stringify(state));
    await putTableTemplate(
      scope,
      'web',
      bearer,
      template.id,
      { ...template, mutationId },
      true,
    );
  }
  localStorage.setItem(key, JSON.stringify({ done: true }));
}
export function refreshRemoteTemplates(scope: TableTemplateScope) {
  return inTemplateScope(scope, async () => {
    const bearer = await token(scope);
    await importLegacy(scope, bearer);
    const rows = await listTableTemplates(scope, 'web', bearer);
    cache(scope, rows, true);
    return readTableTemplateCollection(scope);
  });
}
export function saveRemoteTemplate(
  scope: TableTemplateScope,
  input: SaveTableTemplateInput,
  id: string = crypto.randomUUID(),
) {
  // Reuse this id if an HTTP response was lost and the user retries unchanged input.
  const retryKey = buildTableTemplateStorageKey(scope) + ':retry:' + id;
  const payload = JSON.stringify(input);
  let retry: { payload: string; mutationId: string } | null = null;
  try {
    retry = z
      .object({ payload: z.string(), mutationId: z.string().uuid() })
      .nullable()
      .parse(JSON.parse(localStorage.getItem(retryKey) ?? 'null'));
  } catch {
    /* Start a new mutation. */
  }
  const mutationId =
    retry?.payload === payload ? retry.mutationId : crypto.randomUUID();
  localStorage.setItem(retryKey, JSON.stringify({ payload, mutationId }));
  return inTemplateScope(scope, async () => {
    const bearer = await token(scope);
    await importLegacy(scope, bearer);
    const row = await putTableTemplate(scope, 'web', bearer, id, {
      ...input,
      mutationId,
    });
    cache(scope, [row], false);
    localStorage.removeItem(retryKey);
    return row.deletedAt ? null : TableViewTemplateSchema.parse(row);
  });
}
export function deleteRemoteTemplate(scope: TableTemplateScope, id: string) {
  const retryKey = buildTableTemplateStorageKey(scope) + ':delete:' + id;
  const mutationId = localStorage.getItem(retryKey) ?? crypto.randomUUID();
  localStorage.setItem(retryKey, mutationId);
  return inTemplateScope(scope, async () => {
    const bearer = await token(scope);
    await importLegacy(scope, bearer);
    const row = await removeTableTemplate(scope, 'web', bearer, id, mutationId);
    cache(scope, [row], false);
    localStorage.removeItem(retryKey);
    return true;
  });
}
