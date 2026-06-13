import { useEffect, useState } from 'react';
import { getSession, onSessionChange } from './session';

/**
 * Returns the id of the currently authenticated user, or `null` while the
 * session is unknown/absent. Used to scope per-user table view templates.
 *
 * Reads the initial session once and stays in sync via Supabase auth events,
 * so consumers re-render when the user logs in or out.
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getSession().then((session) => {
      if (active) setUserId(session?.user.id ?? null);
    });

    const unsubscribe = onSessionChange((session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return userId;
}
