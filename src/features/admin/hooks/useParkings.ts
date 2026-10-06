import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { translateApiError } from '../../../lib/api/translate';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  createParking,
  deleteParking,
  getDeletionPreflight,
  listParkings,
  restoreParking,
  updateParking,
  type CreateParkingInput,
  type DeleteParkingInput,
  type DeletionResult,
  type ListParkingsParams,
  type Parking,
  type UpdateParkingInput,
} from '../services/parkings';

const ADMIN_PARKINGS_KEY = ['admin', 'parkings'] as const;

/** Paginated, searchable parking-lot list. Also powers the autocomplete. */
export function useParkingsList(params: ListParkingsParams) {
  return useQuery({
    queryKey: [...ADMIN_PARKINGS_KEY, 'list', params],
    queryFn: () => listParkings(params),
  });
}

type UpdateArgs = { id: string; body: UpdateParkingInput };
type DeleteArgs = { id: string; body: DeleteParkingInput };

/**
 * El preflight del borrado. `enabled` lo ata a que el modal esté abierto: es
 * una ráfaga de conteos sobre ocho tablas y no tiene por qué correr mientras
 * nadie la mire.
 */
export function useDeletionPreflight(id: string | null) {
  return useQuery({
    queryKey: [...ADMIN_PARKINGS_KEY, 'deletion-preflight', id],
    queryFn: () => getDeletionPreflight(id!),
    enabled: id !== null,
    // Los números se piden de nuevo cada vez que se abre el modal: un conteo
    // viejo en una pantalla de confirmación de borrado es peor que no tenerlo.
    staleTime: 0,
    gcTime: 0,
  });
}

export type UseParkingActionsResult = {
  createMutation: UseMutationResult<Parking, unknown, CreateParkingInput>;
  updateMutation: UseMutationResult<Parking, unknown, UpdateArgs>;
  deleteMutation: UseMutationResult<DeletionResult, unknown, DeleteArgs>;
  restoreMutation: UseMutationResult<Parking, unknown, string>;
};

/** Create/update/delete mutations that invalidate the list and surface toasts. */
export function useParkingActions(): UseParkingActionsResult {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_PARKINGS_KEY });
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateParkingInput) => createParking(body),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Estacionamiento creado.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.parkings.create',
        }),
        kind: 'error',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: UpdateArgs) => updateParking(id, body),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Cambios guardados.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.parkings.update',
        }),
        kind: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, body }: DeleteArgs) => deleteParking(id, body),
    onSuccess: (result) => {
      invalidate();

      // Los efectos externos no son fatales —la baja ya está hecha y es
      // reversible— pero un Mercado Pago que no se pudo desvincular es algo
      // que alguien tiene que mirar antes de que la purga borre la fila.
      const failed = result.effects.filter((effect) => !effect.ok);
      if (failed.length > 0) {
        showToast({
          message: `Dado de baja, pero quedó pendiente: ${failed
            .map((effect) => effect.step)
            .join(', ')}.`,
          kind: 'error',
        });
        return;
      }

      showToast({
        message: 'Estacionamiento dado de baja.',
        kind: 'success',
      });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.parkings.delete',
        }),
        kind: 'error',
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreParking(id),
    onSuccess: () => {
      invalidate();
      showToast({
        message:
          'Estacionamiento restaurado. Mercado Pago y ARCA hay que volver a vincularlos a mano.',
        kind: 'success',
      });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.parkings.restore',
        }),
        kind: 'error',
      });
    },
  });

  return { createMutation, updateMutation, deleteMutation, restoreMutation };
}
