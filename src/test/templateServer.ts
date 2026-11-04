import { beforeEach, vi } from 'vitest';
import type {
  SavedTableTemplateDto,
  listTableTemplates,
  putTableTemplate,
  removeTableTemplate,
} from '../lib/api/table-templates';

const templateServer = vi.hoisted(() => ({
  rows: new Map<string, SavedTableTemplateDto>(),
  receipts: new Set<string>(),
  userId: 'user',
  failAfterSave: false,
  failBeforeSave: false,
}));
vi.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              user: { id: templateServer.userId },
              access_token: 'test-token',
            },
          },
        }),
      ),
    },
  },
}));
vi.mock('../lib/api/table-templates', () => {
  const prefix = (
    s: { userId: string; tenantId: string; tableKey: string },
    p: string,
  ) => JSON.stringify([s.userId, p, s.tenantId, s.tableKey]) + ':';
  return {
    listTableTemplates: vi.fn<typeof listTableTemplates>((s, p) =>
      Promise.resolve(
        [...templateServer.rows]
          .filter(([k]) => k.startsWith(prefix(s, p)))
          .map(([, row]) => row),
      ),
    ),
    putTableTemplate: vi.fn<typeof putTableTemplate>(
      async (s, p, _bearer, id, body, importing) => {
        await Promise.resolve();
        if (templateServer.failBeforeSave)
          throw new Error('server unavailable');
        const key = prefix(s, p) + id;
        const receipt = s.userId + ':' + body.mutationId;
        if (
          !templateServer.receipts.has(receipt) &&
          (!importing || !templateServer.rows.has(key))
        ) {
          const now = new Date().toISOString();
          const previous = templateServer.rows.get(key);
          templateServer.rows.set(key, {
            ...body,
            id,
            createdAt: previous?.createdAt ?? body.createdAt ?? now,
            updatedAt: now,
            deletedAt: null,
          });
        }
        templateServer.receipts.add(receipt);
        if (templateServer.failAfterSave) {
          templateServer.failAfterSave = false;
          throw new TypeError('lost response');
        }
        return templateServer.rows.get(key)!;
      },
    ),
    removeTableTemplate: vi.fn<typeof removeTableTemplate>(
      async (s, p, _bearer, id, mutationId) => {
        await Promise.resolve();
        if (templateServer.failBeforeSave)
          throw new Error('server unavailable');
        const key = prefix(s, p) + id;
        const receipt = s.userId + ':' + mutationId;
        if (!templateServer.receipts.has(receipt)) {
          const previous = templateServer.rows.get(key);
          if (previous)
            templateServer.rows.set(key, {
              ...previous,
              deletedAt: new Date().toISOString(),
            });
        }
        templateServer.receipts.add(receipt);
        return templateServer.rows.get(key)!;
      },
    ),
  };
});
export { templateServer };
beforeEach(() => {
  templateServer.rows.clear();
  templateServer.receipts.clear();
  templateServer.userId = 'user';
  templateServer.failAfterSave = false;
  templateServer.failBeforeSave = false;
});
