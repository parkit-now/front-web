import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SaveTableTemplateInput,
  TableTemplateScope,
  TableViewTemplate,
} from './definitions';
import {
  readTableTemplateCollection,
  setLastUsedTableTemplate,
  buildTableTemplateStorageKey,
} from './storage';
import {
  refreshRemoteTemplates,
  saveRemoteTemplate,
  deleteRemoteTemplate,
} from './repository';
import { translateApiError } from '../../lib/api/translate';

export function useTableViewTemplates(
  inputScope: TableTemplateScope | undefined,
) {
  const { userId, tenantId, tableKey } = inputScope ?? {};
  const scope = useMemo(
    () =>
      userId && tenantId && tableKey
        ? { userId, tenantId, tableKey }
        : undefined,
    [userId, tenantId, tableKey],
  );
  const key = scope ? buildTableTemplateStorageKey(scope) : '';
  const currentKey = useRef(key);
  currentKey.current = key;
  const [templates, setTemplates] = useState<TableViewTemplate[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [lastUsedTemplateId, setLastUsedTemplateIdState] = useState<
    string | null
  >(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const newIdRef = useRef(crypto.randomUUID());

  const applyCache = useCallback(() => {
    if (!scope || currentKey.current !== key) return;
    const collection = readTableTemplateCollection(scope);
    setTemplates(collection.templates);
    setLoadedKey(key);
    setLastUsedTemplateIdState(collection.lastUsedTemplateId);
  }, [scope, key]);
  const refresh = useCallback(async () => {
    if (!scope) return;
    applyCache();
    if (!navigator.onLine) return;
    setLoading(true);
    try {
      await refreshRemoteTemplates(scope);
      applyCache();
    } catch {
      // Cached templates remain available; explicit writes report translated errors.
    } finally {
      if (currentKey.current === key) setLoading(false);
    }
  }, [scope, key, applyCache]);
  useEffect(() => {
    setError(null);
    setTemplates(scope ? readTableTemplateCollection(scope).templates : []);
    setLoadedKey(key);
    setLastUsedTemplateIdState(
      scope ? readTableTemplateCollection(scope).lastUsedTemplateId : null,
    );
    newIdRef.current = crypto.randomUUID();
    void refresh();
    const focus = () => void refresh();
    const network = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void refresh();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === key) applyCache();
    };
    window.addEventListener('focus', focus);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('storage', storage);
    };
  }, [scope, key, refresh, applyCache]);

  const mutate = async <T>(action: () => Promise<T>): Promise<T | null> => {
    if (busyRef.current || !navigator.onLine) return null;
    const capturedKey = key;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      applyCache();
      return currentKey.current === capturedKey ? result : null;
    } catch (cause) {
      if (currentKey.current === capturedKey)
        setError(translateApiError(cause));
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const save = (input: SaveTableTemplateInput) =>
    scope
      ? mutate(async () => {
          const result = await saveRemoteTemplate(
            scope,
            input,
            newIdRef.current,
          );
          if (result) newIdRef.current = crypto.randomUUID();
          return result;
        })
      : Promise.resolve(null);
  const overwrite = (id: string, config: SaveTableTemplateInput['config']) => {
    const existing = templates.find((t) => t.id === id);
    return scope && existing
      ? mutate(() => saveRemoteTemplate(scope, { ...existing, config }, id))
      : Promise.resolve(null);
  };
  const updateMetadata = (
    id: string,
    input: { name: string; description?: string },
  ) => {
    const existing = templates.find((t) => t.id === id);
    return scope && existing
      ? mutate(() => saveRemoteTemplate(scope, { ...existing, ...input }, id))
      : Promise.resolve(null);
  };
  const remove = (id: string) =>
    scope
      ? mutate(() => deleteRemoteTemplate(scope, id))
      : Promise.resolve(null);
  const setLastUsed = (id: string | null) => {
    if (!scope) return;
    setLastUsedTableTemplate(scope, id);
    setLastUsedTemplateIdState(id);
  };
  return {
    enabled: Boolean(scope),
    templates: loadedKey === key ? templates : [],
    lastUsedTemplateId,
    refresh,
    save,
    overwrite,
    remove,
    updateMetadata,
    setLastUsed,
    busy,
    loading,
    error,
    canWrite: loadedKey === key && online && !busy && !loading,
  };
}
