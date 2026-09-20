import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api/client';
import { getMpAccount, type MpAccount } from '../services/mercado-pago';

/**
 * Clave de la cuenta de Mercado Pago del estacionamiento.
 *
 * Se exporta aparte porque Integraciones la invalida después de vincular,
 * desvincular o resincronizar, y una clave escrita dos veces se desincroniza
 * al primer cambio.
 */
export function mpAccountQueryKey(tenantId: string) {
  return ['mercado-pago', 'account', tenantId] as const;
}

/**
 * La cuenta de Mercado Pago vinculada, o `null` si no hay ninguna.
 *
 * OJO: "sin vincular" NO es un 200 con `null`, es un **404 `MP_NOT_LINKED`**.
 *
 * Ese 404 es el camino feliz de una playa nueva. Si lo dejáramos propagar, el
 * dueño entraría por primera vez y lo recibiría un toast rojo diciéndole que
 * algo falló. Lo atajamos acá y lo devolvemos como `null`, que es lo que la UI
 * entiende por "todavía no vinculaste".
 *
 * Vive como hook y no inline en cada página porque ya son dos las que
 * preguntan lo mismo (Integraciones y Métodos de pago). Duplicar el `catch`
 * del 404 es duplicar la trampa: alcanza con que una copia se olvide de
 * atraparlo para que la pantalla se llene de errores falsos.
 */
export function useMpAccount(tenantId: string) {
  return useQuery<MpAccount | null>({
    queryKey: mpAccountQueryKey(tenantId),
    queryFn: async () => {
      try {
        return await getMpAccount(tenantId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(tenantId),
    // El `catch` de arriba ya se come el 404, así que react-query no debería
    // verlo nunca. Lo dejamos explícito igual: ningún 4xx se arregla
    // reintentando, y si alguien saca el `catch` no queremos tres viajes de
    // ida y vuelta contra una playa que simplemente no vinculó nada.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? false
        : failureCount < 2,
  });
}
