import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { translateApiError } from '../../../lib/api/translate';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  approveApplication,
  getApplicationDetail,
  listApplications,
  rejectApplication,
  type ApplicationDetail,
  type ApplicationStatus,
  type ApplicationSummary,
} from '../services/applications';

const ADMIN_APPLICATIONS_KEY = ['admin', 'applications'] as const;

/** Review queue, filtered by status (defaults to `pending`). */
export function useApplicationsList(status: ApplicationStatus = 'pending') {
  return useQuery({
    queryKey: [...ADMIN_APPLICATIONS_KEY, 'list', status],
    queryFn: () => listApplications(status),
  });
}

/** Full detail for the selected application; disabled when no id is selected. */
export function useApplicationDetail(id: string | null) {
  return useQuery({
    queryKey: [...ADMIN_APPLICATIONS_KEY, 'detail', id],
    queryFn: () => getApplicationDetail(id as string),
    enabled: id !== null,
  });
}

type RejectArgs = { id: string; reason: string };

export type UseApplicationActionsResult = {
  approveMutation: UseMutationResult<ApplicationSummary, unknown, string>;
  rejectMutation: UseMutationResult<ApplicationSummary, unknown, RejectArgs>;
};

/** Approve/reject mutations that invalidate the queue and surface toasts. */
export function useApplicationActions(): UseApplicationActionsResult {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_APPLICATIONS_KEY });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveApplication(id),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Alta aprobada correctamente.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.applications.approve',
        }),
        kind: 'error',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: RejectArgs) => rejectApplication(id, reason),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Solicitud rechazada.', kind: 'info' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.applications.reject',
        }),
        kind: 'error',
      });
    },
  });

  return { approveMutation, rejectMutation };
}

export type { ApplicationDetail };
