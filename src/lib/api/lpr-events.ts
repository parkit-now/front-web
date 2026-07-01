import type { components } from '../../generated/api-types';
import { apiRequest } from './client';

export type LprDetectionEventImageSignedUrlDto =
  components['schemas']['LprDetectionEventImageSignedUrlDto'];

/**
 * Short-lived (5 min) signed URL to preview an event's photo. Minted on
 * demand — the backend never returns a permanent image URL, since the photo
 * can contain plate and vehicle identity. Fetch again if it expires.
 */
export function getLprDetectionEventImageSignedUrl(input: {
  tenantId: string;
  bearer: string;
  eventId: string;
}): Promise<LprDetectionEventImageSignedUrlDto> {
  return apiRequest<LprDetectionEventImageSignedUrlDto>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/lpr-events/${encodeURIComponent(input.eventId)}/image-signed-url`,
    bearer: input.bearer,
  });
}
