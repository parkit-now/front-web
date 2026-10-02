import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_ACTIVE_TENANT_KEY,
  activeTenantStorageKey,
  clearStoredActiveTenant,
  readStoredActiveTenant,
  resolveActiveTenantId,
  writeStoredActiveTenant,
} from './activeTenant';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('resolveActiveTenantId', () => {
  it('sin lista cargada no hay activo: el candidato sin validar es el bug', () => {
    expect(resolveActiveTenantId(A, [])).toBe('');
    expect(resolveActiveTenantId(null, [])).toBe('');
  });

  it('respeta el candidato si pertenece a la lista', () => {
    expect(resolveActiveTenantId(B, [A, B])).toBe(B);
  });

  it('cae al primero si el candidato es de otra cuenta', () => {
    expect(resolveActiveTenantId(C, [A, B])).toBe(A);
  });

  it('cae al primero si no hay candidato', () => {
    expect(resolveActiveTenantId(null, [A, B])).toBe(A);
    expect(resolveActiveTenantId('', [A, B])).toBe(A);
    expect(resolveActiveTenantId(undefined, [A])).toBe(A);
  });
});

describe('persistencia del tenant activo', () => {
  // El entorno de tests es `node`: no hay `window`. Un Storage mínimo en memoria
  // alcanza para ejercitar la lógica de keys.
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
        removeItem: (k: string) => void data.delete(k),
        clear: () => data.clear(),
      },
    });
  });

  it('scopea la key por usuario', () => {
    expect(activeTenantStorageKey('u1')).toBe('parkit.activeTenantId:u1');
  });

  it('un usuario no ve el id guardado por otro', () => {
    writeStoredActiveTenant('u1', A);
    expect(readStoredActiveTenant('u1')).toBe(A);
    expect(readStoredActiveTenant('u2')).toBeNull();
  });

  it('migra la key vieja como candidato y la borra al guardar', () => {
    window.localStorage.setItem(LEGACY_ACTIVE_TENANT_KEY, A);
    expect(readStoredActiveTenant('u1')).toBe(A);
    writeStoredActiveTenant('u1', B);
    expect(window.localStorage.getItem(LEGACY_ACTIVE_TENANT_KEY)).toBeNull();
    expect(readStoredActiveTenant('u1')).toBe(B);
  });

  it('el valor scopeado gana sobre la key vieja', () => {
    window.localStorage.setItem(LEGACY_ACTIVE_TENANT_KEY, A);
    window.localStorage.setItem(activeTenantStorageKey('u1'), B);
    expect(readStoredActiveTenant('u1')).toBe(B);
  });

  it('clear borra la key del usuario y la vieja, y no toca la de otros', () => {
    window.localStorage.setItem(LEGACY_ACTIVE_TENANT_KEY, A);
    writeStoredActiveTenant('u1', B);
    writeStoredActiveTenant('u2', C);
    window.localStorage.setItem(LEGACY_ACTIVE_TENANT_KEY, A);
    clearStoredActiveTenant('u1');
    expect(window.localStorage.getItem(LEGACY_ACTIVE_TENANT_KEY)).toBeNull();
    expect(readStoredActiveTenant('u1')).toBeNull();
    expect(readStoredActiveTenant('u2')).toBe(C);
  });
});
