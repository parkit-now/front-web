import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { translateApiError } from '../../../lib/api/translate';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  createApplication,
  getLatestApplication,
  submitApplication,
  updateApplication,
  uploadAndRegisterDocument,
  type Application,
  type ApplicationDocument,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '../services/onboarding';

const ONBOARDING_QUERY_KEY = ['onboarding', 'applications'] as const;

type UpdateApplicationArgs = {
  applicationId: string;
  input: UpdateApplicationInput;
};

type UploadDocumentArgs = {
  applicationId: string;
  file: File;
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
  uploadDocumentMutation: UseMutationResult<
    ApplicationDocument,
    unknown,
    UploadDocumentArgs
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
  });

  const createApplicationMutation = useMutation({
    mutationFn: (input: CreateApplicationInput) => createApplication(input),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'onboarding.createApplication',
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

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ applicationId, file }: UploadDocumentArgs) =>
      uploadAndRegisterDocument(applicationId, file),
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
    application: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
    createApplicationMutation,
    updateApplicationMutation,
    uploadDocumentMutation,
    submitApplicationMutation,
  };
}
