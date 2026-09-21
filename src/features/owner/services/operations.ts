import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type Entry = components['schemas']['EntryDto'];
export type PaymentTransaction = components['schemas']['PaymentTransactionDto'];
export type PaymentTransactionChangesResponse =
  components['schemas']['PaymentTransactionChangesResponseDto'];

const CHANGES_PAGE_SIZE = 500;

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

export async function listEntries(tenantId: string): Promise<Entry[]> {
  return apiRequest<Entry[]>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(tenantId)}/entries`,
    bearer: await bearer(),
  });
}

export async function listPaymentTransactions(
  tenantId: string,
): Promise<PaymentTransaction[]> {
  const token = await bearer();
  const all: PaymentTransaction[] = [];
  let afterSeq = 0;

  while (true) {
    const params = new URLSearchParams({
      afterSeq: String(afterSeq),
      limit: String(CHANGES_PAGE_SIZE),
    });
    const page = await apiRequest<PaymentTransactionChangesResponse>({
      method: 'GET',
      path: `/tenants/${encodeURIComponent(tenantId)}/payment-transactions/changes?${params.toString()}`,
      bearer: token,
    });

    const items = page.items ?? [];
    all.push(...items);
    if (items.length < CHANGES_PAGE_SIZE || page.maxSeq <= afterSeq) break;
    afterSeq = page.maxSeq;
  }

  return all.filter((tx) => !tx.deletedAt);
}
