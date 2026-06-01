import { type Provider, type Session } from '@supabase/supabase-js';
import {
  getMe,
  logoutBackend,
  loginWithPassword,
  refreshSessionTokens,
  registerWithPassword,
  type MeResponseDto,
  type SessionDto,
} from '../api/auth';
import { supabase } from './client';

function resolveRedirectUrl(): string | undefined {
  const customRedirectRaw: unknown = import.meta.env
    .VITE_SUPABASE_OAUTH_REDIRECT_URL;

  const customRedirect =
    typeof customRedirectRaw === 'string' ? customRedirectRaw : undefined;

  if (typeof customRedirect === 'string' && customRedirect.length > 0) {
    return customRedirect;
  }

  if (typeof window !== 'undefined') {
    // Land the OAuth callback on /login: AuthPage detects the session from the
    // URL hash and redirects by role. Must be allow-listed in
    // supabase/config.toml (additional_redirect_urls).
    return `${window.location.origin}/login`;
  }

  return undefined;
}

async function applyBackendSession(tokens: SessionDto): Promise<Session> {
  const { data, error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error('No se pudo establecer la sesión local.');
  }

  return data.session;
}

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

/**
 * Global platform role carried in the JWT (`app_metadata.role`). The
 * owner/operator distinction is NOT a global role anymore: it lives on the
 * user↔entity membership (see `MeResponseDto.memberships`) and is resolved via
 * `GET /auth/me`.
 */
export type AppRole = 'admin' | 'user';

/** Base64url-decodes a JWT payload. Returns null if the token is malformed. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reads the app role from the JWT (`app_metadata.role`). The Supabase custom
 * access token hook injects it into the token on every mint (email AND OAuth),
 * so the client routes by role with no extra request.
 *
 * The role lives in the JWT claims, NOT in the stored user record
 * (`raw_app_meta_data`): OAuth users are auto-provisioned without it, so
 * `session.user.app_metadata.role` is empty for them. We therefore read the
 * decoded access token first and fall back to the user metadata. Returns null
 * for legacy tokens issued before the claim existed.
 */
export function getRoleFromSession(session: Session | null): AppRole | null {
  if (!session) return null;

  const fromJwt = (
    decodeJwtPayload(session.access_token)?.app_metadata as
      | { role?: unknown }
      | undefined
  )?.role;
  const fromUser = (session.user.app_metadata as { role?: unknown } | undefined)
    ?.role;
  const role = fromJwt ?? fromUser;

  return role === 'admin' || role === 'user' ? role : null;
}

/**
 * Default landing path from the GLOBAL role alone.
 *   - admin → Ops portal.
 *   - user  → app portal as a safe default. The real destination for a `user`
 *             depends on memberships and must be resolved with
 *             `resolveHomePath` / `/auth/me`; this synchronous helper is only a
 *             fallback when memberships are not available yet.
 */
export function homePathForRole(role: AppRole | null): string {
  switch (role) {
    case 'admin':
      return '/ops';
    default:
      return '/app';
  }
}

/**
 * Resolves the landing path from the caller's global role AND entity
 * memberships (`GET /auth/me`):
 *   - admin                          → `/ops`.
 *   - user with an `owner` membership → `/app` (owner portal).
 *   - user with only `operator`       → `/app` (operations view).
 *   - user with no memberships        → `/onboarding`.
 */
export function homePathForMe(me: MeResponseDto): string {
  if (me.role === 'admin') return '/ops';
  if (me.memberships.length === 0) return '/onboarding';
  return '/app';
}

/** Fetches `/auth/me` with the session bearer; null when unauthenticated. */
export async function fetchMe(
  session: Session | null,
): Promise<MeResponseDto | null> {
  const accessToken = session?.access_token;
  if (!accessToken) return null;
  return getMe(accessToken);
}

/**
 * Resolves the landing path for the current session, querying `/auth/me` when
 * the global role is `user` (admins route to `/ops` without the extra call).
 */
export async function resolveHomePath(
  session: Session | null,
): Promise<string> {
  if (!session) return '/login';
  const role = getRoleFromSession(session);
  if (role === 'admin') return '/ops';
  const me = await fetchMe(session);
  if (!me) return '/login';
  return homePathForMe(me);
}

export function onSessionChange(
  callback: (session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function signInWithProvider(provider: Provider): Promise<void> {
  const redirectTo = resolveRedirectUrl();

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error) {
    throw error;
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<Session> {
  const tokens = await loginWithPassword({ email, password });
  return applyBackendSession(tokens);
}

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<Session> {
  const result = await registerWithPassword({ email, password });
  return applyBackendSession(result.session);
}

export async function refreshCurrentSession(): Promise<Session | null> {
  const current = await getSession();
  if (!current?.refresh_token) {
    return null;
  }
  const tokens = await refreshSessionTokens({
    refreshToken: current.refresh_token,
  });
  return applyBackendSession(tokens);
}

export async function signOut(): Promise<void> {
  const current = await getSession();
  const accessToken = current?.access_token;

  if (accessToken) {
    try {
      await logoutBackend(accessToken);
    } catch {
      // Backend revoke falló: igual limpiamos sesión local para no dejar al usuario atrapado.
    }
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
