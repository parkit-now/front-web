import { useQuery } from '@tanstack/react-query';
import { fetchMe, getSession } from '../../../lib/supabase/session';
import { REVIEW_POLL_MS } from './useOnboarding';

export const ONBOARDING_ME_QUERY_KEY = ['onboarding', 'me'] as const;

/**
 * `GET /auth/me` de la persona que está dando de alta el estacionamiento:
 * alimenta el bloque "Persona encargada" (nombre y email de la cuenta) y, con
 * la solicitud en revisión, detecta que Ops la aprobó (aparecen memberships)
 * para mandarla al panel sin que tenga que recargar.
 */
export function useOnboardingAccount({ poll }: { poll: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_ME_QUERY_KEY,
    queryFn: async () => fetchMe(await getSession()),
    refetchInterval: poll ? REVIEW_POLL_MS : false,
  });
}
