import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type OnboardingState = components['schemas']['OnboardingStateDto'];
export type CompanyProfile = components['schemas']['CompanyProfileDto'];
export type ApplicationView = components['schemas']['OnboardingApplicationDto'];
export type CompanyDocument = components['schemas']['CompanyDocumentDto'];
export type CreateCompanyInput =
  components['schemas']['CreateCompanyOnboardingDto'];
export type UpdateApplicationInput =
  components['schemas']['UpdateApplicationDto'];
export type DeclaredBranchInput =
  components['schemas']['DeclaredBranchInputDto'];
export type RegisterDocumentInput =
  components['schemas']['RegisterDocumentDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/** GET /onboarding/me — company + latest application for the current user. */
export async function getOnboardingState(): Promise<OnboardingState> {
  return apiRequest<OnboardingState>({
    method: 'GET',
    path: '/onboarding/me',
    bearer: await bearer(),
  });
}

/** POST /onboarding/company — create the company (promotes a driver to owner). */
export async function createCompany(
  input: CreateCompanyInput,
): Promise<OnboardingState> {
  return apiRequest<OnboardingState>({
    method: 'POST',
    path: '/onboarding/company',
    body: input,
    bearer: await bearer(),
  });
}

/** PATCH /onboarding/application/:id — edit company data and/or branches. */
export async function updateApplication(
  applicationId: string,
  input: UpdateApplicationInput,
): Promise<OnboardingState> {
  return apiRequest<OnboardingState>({
    method: 'PATCH',
    path: `/onboarding/application/${applicationId}`,
    body: input,
    bearer: await bearer(),
  });
}

/** POST /onboarding/application/:id/documents — register document metadata. */
export async function addDocument(
  applicationId: string,
  input: RegisterDocumentInput,
): Promise<CompanyDocument> {
  return apiRequest<CompanyDocument>({
    method: 'POST',
    path: `/onboarding/application/${applicationId}/documents`,
    body: input,
    bearer: await bearer(),
  });
}

/** POST /onboarding/application/:id/submit — send for review (→ pending_review). */
export async function submitApplication(
  applicationId: string,
): Promise<OnboardingState> {
  return apiRequest<OnboardingState>({
    method: 'POST',
    path: `/onboarding/application/${applicationId}/submit`,
    bearer: await bearer(),
  });
}
