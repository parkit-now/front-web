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
  listParkings,
  updateParking,
  type CreateParkingInput,
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

export type UseParkingActionsResult = {
  createMutation: UseMutationResult<Parking, unknown, CreateParkingInput>;
  updateMutation: UseMutationResult<Parking, unknown, UpdateArgs>;
  deleteMutation: UseMutationResult<void, unknown, string>;
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
    mutationFn: (id: string) => deleteParking(id),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Estacionamiento eliminado.', kind: 'success' });
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

  return { createMutation, updateMutation, deleteMutation };
}
