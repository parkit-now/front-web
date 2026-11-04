import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import {
  fetchMe,
  getRoleFromSession,
  getSession,
  homePathForMe,
  homePathForRole,
  onSessionChange,
  refreshCurrentSession,
  registerWithEmail,
  resolveHomePath,
  signInWithEmail,
  signInWithProvider,
  signOut,
} from './session';

const auth = vi.hoisted(() => ({
  setSession: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  refreshSessionTokens: vi.fn(),
  logoutBackend: vi.fn(),
}));
const tenant = vi.hoisted(() => ({ clearStoredActiveTenant: vi.fn() }));

vi.mock('./client', () => ({ supabase: { auth } }));
vi.mock('../api/auth', () => api);
vi.mock('../tenant/activeTenant', () => tenant);

/** JWT sin firma con `app_metadata.role`, como el que arma Supabase. */
function jwt(payload: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode(payload)}.firma`;
}

function session(role?: string, userRole?: string): Session {
  return {
    access_token: jwt(role ? { app_metadata: { role } } : {}),
    refresh_token: 'refresh',
    user: {
      id: 'user-1',
      app_metadata: userRole ? { role: userRole } : {},
    },
  } as unknown as Session;
}

const TOKENS = { accessToken: 'access', refreshToken: 'refresh' };
const ME = { role: 'user', memberships: [{ tenantId: 't' }] };

beforeEach(() => {
  vi.clearAllMocks();
  auth.setSession.mockResolvedValue({
    data: { session: session() },
    error: null,
  });
  auth.getSession.mockResolvedValue({ data: { session: session() } });
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInWithOAuth.mockResolvedValue({ error: null });
});

describe('roles y destino inicial', () => {
  it('lee el rol del JWT y, si no está, del usuario', () => {
    expect(getRoleFromSession(null)).toBeNull();
    expect(getRoleFromSession(session('admin'))).toBe('admin');
    expect(getRoleFromSession(session(undefined, 'user'))).toBe('user');
    expect(getRoleFromSession(session('otro'))).toBeNull();
    expect(
      getRoleFromSession({
        access_token: 'no-es-jwt',
        user: { app_metadata: {} },
      } as unknown as Session),
    ).toBeNull();
  });

  it('manda a cada rol a su panel', () => {
    expect(homePathForRole('admin')).toBe('/ops');
    expect(homePathForRole('user')).toBe('/app');
    expect(homePathForRole(null)).toBe('/app');
    expect(homePathForMe({ role: 'admin', memberships: [] } as never)).toBe(
      '/ops',
    );
    expect(homePathForMe({ role: 'user', memberships: [] } as never)).toBe(
      '/onboarding',
    );
    expect(homePathForMe(ME as never)).toBe('/app');
  });

  it('resuelve el destino según la sesión y /me', async () => {
    expect(await resolveHomePath(null)).toBe('/login');
    expect(await resolveHomePath(session('admin'))).toBe('/ops');

    api.getMe.mockResolvedValue(ME);
    expect(await resolveHomePath(session())).toBe('/app');

    api.getMe.mockRejectedValue(new ApiError(401, 'Unauthorized', null));
    expect(await resolveHomePath(session())).toBe('/login');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('fetchMe propaga los errores que no son de sesión', async () => {
    expect(await fetchMe(null)).toBeNull();

    api.getMe.mockRejectedValue(new ApiError(500, 'boom', null));
    await expect(fetchMe(session())).rejects.toThrow('boom');
  });
});

describe('inicio y cierre de sesión', () => {
  it('getSession devuelve la sesión de Supabase', async () => {
    const current = session();
    auth.getSession.mockResolvedValue({ data: { session: current } });

    await expect(getSession()).resolves.toBe(current);
  });

  it('onSessionChange avisa y se desuscribe', () => {
    const unsubscribe = vi.fn();
    auth.onAuthStateChange.mockImplementation(
      (handler: (event: string, value: unknown) => void) => {
        handler('SIGNED_OUT', null);
        return { data: { subscription: { unsubscribe } } };
      },
    );
    const callback = vi.fn();

    onSessionChange(callback)();

    expect(callback).toHaveBeenCalledWith(null);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('OAuth sin ventana ni URL configurada usa el redirect de Supabase', async () => {
    await signInWithProvider('google');

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: undefined,
    });

    auth.signInWithOAuth.mockResolvedValue({ error: new Error('oauth') });
    await expect(signInWithProvider('github')).rejects.toThrow('oauth');
  });

  it('login y registro guardan los tokens del backend', async () => {
    api.loginWithPassword.mockResolvedValue(TOKENS);
    api.registerWithPassword.mockResolvedValue({ session: TOKENS });

    await signInWithEmail('ana@parkit.test', 'secreto');
    await registerWithEmail('  Ana  ', 'ana@parkit.test', 'secreto123');

    expect(api.registerWithPassword).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@parkit.test',
      password: 'secreto123',
    });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });

  it('falla si Supabase no arma la sesión', async () => {
    api.loginWithPassword.mockResolvedValue(TOKENS);
    auth.setSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    await expect(signInWithEmail('a@b.c', 'x')).rejects.toThrow(
      'No se pudo establecer la sesión local.',
    );

    auth.setSession.mockResolvedValueOnce({ error: new Error('jwt') });
    await expect(signInWithEmail('a@b.c', 'x')).rejects.toThrow('jwt');
  });

  it('renueva con el refresh token y sin sesión no hace nada', async () => {
    api.refreshSessionTokens.mockResolvedValue(TOKENS);
    await refreshCurrentSession();
    expect(api.refreshSessionTokens).toHaveBeenCalledWith({
      refreshToken: 'refresh',
    });

    auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(refreshCurrentSession()).resolves.toBeNull();
  });

  it('cierra sesión aunque el backend falle y olvida la sede activa', async () => {
    api.logoutBackend.mockRejectedValue(new Error('offline'));

    await signOut();

    expect(tenant.clearStoredActiveTenant).toHaveBeenCalledWith('user-1');
    expect(auth.signOut).toHaveBeenCalledWith();
  });

  it('propaga el error de Supabase al cerrar sesión', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('storage') });

    await expect(signOut()).rejects.toThrow('storage');
  });
});
