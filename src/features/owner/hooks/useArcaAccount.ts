import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api/client';
import { getArcaAccount, type ArcaAccount } from '../services/arca';

/**
 * Clave de la cuenta de ARCA de la sede.
 *
 * Se exporta aparte porque Integraciones y el wizard la invalidan después de
 * cada mutación (crear, subir certificado, punto de venta, desvincular...):
 * una clave escrita dos veces se desincroniza al primer cambio.
 */
export function arcaAccountQueryKey(tenantId: string) {
  return ['arca', 'account', tenantId] as const;
}

/**
 * La cuenta de ARCA vinculada, o `null` si no hay ninguna.
 *
 * OJO: "sin vincular" NO es un 200 con `null`, es un **404 `ARCA_NOT_LINKED`**
 * (calcado de `useMpAccount`). Ese 404 es el camino feliz de una playa que
 * todavía no vinculó facturación electrónica, o que la desvinculó: lo atajamos
 * acá y lo devolvemos como `null`, que es lo que la UI entiende por "todavía
 * no vinculaste".
 */
export function useArcaAccount(tenantId: string) {
  return useQuery<ArcaAccount | null>({
    queryKey: arcaAccountQueryKey(tenantId),
    queryFn: async () => {
      try {
        return await getArcaAccount(tenantId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(tenantId),
    // Ningún 4xx se arregla reintentando, y el `catch` de arriba ya se come el
    // 404 (el único 4xx esperable en el camino feliz).
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? false
        : failureCount < 2,
  });
}
