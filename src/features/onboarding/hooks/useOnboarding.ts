import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { mapSubmitError } from '../errors';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  createApplication,
  getLatestApplication,
  submitApplication,
  updateApplication,
  type Application,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '../services/onboarding';

/** Cada cuánto se consulta si Ops ya resolvió una solicitud en revisión. */
export const REVIEW_POLL_MS = 30_000;

const ONBOARDING_QUERY_KEY = ['onboarding', 'applications'] as const;

type UpdateApplicationArgs = {
  applicationId: string;
  input: UpdateApplicationInput;
};

export type UseOnboardingResult = {
  application: Application | null | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  createApplicationMutation: UseMutationResult<
    Application,
    unknown,
    CreateApplicationInput
  >;
  updateApplicationMutation: UseMutationResult<
    Application,
    unknown,
    UpdateApplicationArgs
  >;
  submitApplicationMutation: UseMutationResult<Application, unknown, string>;
};

/**
 * Wraps the onboarding query and its mutations behind a single hook. Every
 * mutation invalidates `['onboarding','applications']` on success and surfaces a
 * translated toast on error, so the components stay declarative.
 */
export function useOnboarding(): UseOnboardingResult {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
  }, [queryClient]);

  const query = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: getLatestApplication,
    // En revisión no hay nada que editar: se vuelve a preguntar cada tanto para
    // enterarse de la decisión de Ops (aprobada o rechazada) sin recargar.
    refetchInterval: (q) =>
      q.state.data?.status === 'pending_review' ? REVIEW_POLL_MS : false,
  });

  const createApplicationMutation = useMutation({
    mutationFn: (input: CreateApplicationInput) => createApplication(input),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      showToast({
        message: mapSubmitError(error, 'onboarding.createApplication'),
        kind: 'error',
      });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: ({ applicationId, input }: UpdateApplicationArgs) =>
      updateApplication(applicationId, input),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      showToast({
        message: mapSubmitError(error, 'onboarding.updateApplication'),
        kind: 'error',
      });
    },
  });

  const submitApplicationMutation = useMutation({
    mutationFn: (applicationId: string) => submitApplication(applicationId),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      // `mapSubmitError` (y no `translateApiError` pelado): el 422
      // `ONBOARDING_NOT_SUBMITTABLE` trae en `validationsErrors` QUÉ campo de
      // la dirección falta, y decirlo es la diferencia entre "completá los
      // datos requeridos" y "falta la calle y la altura".
      showToast({ message: mapSubmitError(error), kind: 'error' });
    },
  });

  return {
    application: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
    createApplicationMutation,
    updateApplicationMutation,
    submitApplicationMutation,
  };
}
