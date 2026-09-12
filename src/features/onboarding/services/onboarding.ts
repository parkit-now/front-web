import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';
import { uploadApplicationDocument } from '../../../lib/supabase/storage';

export type Application = components['schemas']['OnboardingApplicationDto'];
export type ApplicationDocument =
  components['schemas']['ApplicationDocumentDto'];
export type CreateApplicationInput =
  components['schemas']['CreateApplicationDto'];
export type UpdateApplicationInput =
  components['schemas']['UpdateApplicationDto'];

/**
 * Typed view of `Application.declaredEntity`, the opaque JSON snapshot the
 * applicant declares before approval. Every field is optional because a draft
 * may be partially filled.
 */
export type DeclaredEntity = {
  name?: string;
  address?: string;
  legalName?: string;
  cuit?: string;
  email?: string;
  phone?: string;
  totalSpots?: number;
};

/** Reads `declaredEntity` as a typed object (empty when absent). */
export function readDeclaredEntity(
  application: Application | null,
): DeclaredEntity {
  const raw = application?.declaredEntity;
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /onboarding/applications — the user's applications, newest first. Returns
 * the latest one (the entity declares a single parking lot) or `null` when the
 * user has never started onboarding. An empty list is NOT an error.
 */
export async function getLatestApplication(): Promise<Application | null> {
  const list = await apiRequest<Application[]>({
    method: 'GET',
    path: '/onboarding/applications',
    bearer: await bearer(),
  });
  if (list.length === 0) return null;
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** POST /onboarding/applications — create the draft application for one lot. */
export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  return apiRequest<Application>({
    method: 'POST',
    path: '/onboarding/applications',
    body: input,
    bearer: await bearer(),
  });
}

/** PATCH /onboarding/applications/:id — edit a draft/rejected application. */
export async function updateApplication(
  applicationId: string,
  input: UpdateApplicationInput,
): Promise<Application> {
  return apiRequest<Application>({
    method: 'PATCH',
    path: `/onboarding/applications/${applicationId}`,
    body: input,
    bearer: await bearer(),
  });
}

/**
 * Uploads the binary to Supabase Storage and then registers its metadata via
 * POST /onboarding/applications/:id/documents.
 */
export async function uploadAndRegisterDocument(
  applicationId: string,
  file: File,
): Promise<ApplicationDocument> {
  const { storagePath, mimeType, name } = await uploadApplicationDocument(
    applicationId,
    file,
  );
  return apiRequest<ApplicationDocument>({
    method: 'POST',
    path: `/onboarding/applications/${applicationId}/documents`,
    body: { name, storagePath, ...(mimeType ? { mimeType } : {}) },
    bearer: await bearer(),
  });
}

/** POST /onboarding/applications/:id/submit — send for review (→ pending_review). */
export async function submitApplication(
  applicationId: string,
): Promise<Application> {
  return apiRequest<Application>({
    method: 'POST',
    path: `/onboarding/applications/${applicationId}/submit`,
    bearer: await bearer(),
  });
}
