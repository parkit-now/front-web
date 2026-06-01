import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { translateApiError } from '../../../lib/api/translate';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { refreshCurrentSession } from '../../../lib/supabase/session';
import {
  addDocument,
  createCompany,
  getOnboardingState,
  submitApplication,
  updateApplication,
  type CreateCompanyInput,
  type CompanyDocument,
  type OnboardingState,
  type RegisterDocumentInput,
  type UpdateApplicationInput,
} from '../services/onboarding';

const ONBOARDING_QUERY_KEY = ['onboarding', 'me'] as const;

type UpdateApplicationArgs = {
  applicationId: string;
  input: UpdateApplicationInput;
};

type AddDocumentArgs = {
  applicationId: string;
  input: RegisterDocumentInput;
};

export type UseOnboardingResult = {
  state: OnboardingState | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  createCompanyMutation: UseMutationResult<
    OnboardingState,
    unknown,
    CreateCompanyInput
  >;
  updateApplicationMutation: UseMutationResult<
    OnboardingState,
    unknown,
    UpdateApplicationArgs
  >;
  addDocumentMutation: UseMutationResult<
    CompanyDocument,
    unknown,
    AddDocumentArgs
  >;
  submitApplicationMutation: UseMutationResult<
    OnboardingState,
    unknown,
    string
  >;
};

/**
 * Wraps the onboarding query and the four mutations behind a single hook.
 * Every mutation invalidates `['onboarding','me']` on success and surfaces a
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
    queryFn: getOnboardingState,
  });

  const createCompanyMutation = useMutation({
    mutationFn: (input: CreateCompanyInput) => createCompany(input),
    onSuccess: async () => {
      // The backend promoted the driver to owner: refresh the JWT so the role
      // claim updates. Best-effort — ignore failures, the wizard still advances.
      try {
        await refreshCurrentSession();
      } catch {
        // Ignore: a stale role claim does not block the draft steps.
      }
      invalidate();
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'onboarding.createCompany',
        }),
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
        message: translateApiError(error, {
          endpoint: 'onboarding.updateApplication',
        }),
        kind: 'error',
      });
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: ({ applicationId, input }: AddDocumentArgs) =>
      addDocument(applicationId, input),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'onboarding.addDocument',
        }),
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
      showToast({
        message: translateApiError(error, { endpoint: 'onboarding.submit' }),
        kind: 'error',
      });
    },
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
    createCompanyMutation,
    updateApplicationMutation,
    addDocumentMutation,
    submitApplicationMutation,
  };
}
