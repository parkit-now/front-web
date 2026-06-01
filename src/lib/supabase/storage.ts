import { supabase } from './client';

/** Private bucket provisioned by the backend migration `add_application_documents_bucket`. */
const APPLICATION_DOCUMENTS_BUCKET = 'application-documents';

export type UploadedDocument = {
  /** Object key inside the bucket, persisted as `storagePath` metadata. */
  storagePath: string;
  /** MIME type reported by the browser, or `undefined` when unknown. */
  mimeType: string | undefined;
  /** Original, human-readable file name. */
  name: string;
};

/**
 * Builds a safe object key segment from a file name, preserving the extension.
 * Storage object keys must avoid spaces and non-ASCII characters.
 */
function safeObjectName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot + 1) : '';
  const slug = base
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = slug || 'documento';
  return safeExt ? `${name}.${safeExt}` : name;
}

/**
 * Uploads a document binary to Supabase Storage under
 * `applications/<userId>/<applicationId>/<file>`. The owner segment lets the
 * bucket RLS policies authorize the write from the JWT alone (`auth.uid()`),
 * without reading the backend-only `onboarding_applications` table.
 * Returns the metadata the backend needs to register the document.
 */
export async function uploadApplicationDocument(
  applicationId: string,
  file: File,
): Promise<UploadedDocument> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) {
    throw new Error('No active session');
  }
  const storagePath = `applications/${userId}/${applicationId}/${safeObjectName(file.name)}`;
  const { error } = await supabase.storage
    .from(APPLICATION_DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) {
    throw error;
  }

  return {
    storagePath,
    mimeType: file.type || undefined,
    name: file.name,
  };
}
