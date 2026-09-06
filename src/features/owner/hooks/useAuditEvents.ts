import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  listAuditEvents,
  type AuditAction,
  type AuditSeverity,
} from '../services/audit';
import { useSucursal } from '../context/SucursalContext';

export interface AuditFilters {
  severity?: AuditSeverity;
  action?: AuditAction;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export function useAuditEvents(filters: AuditFilters) {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: ['audit', sucursalId, filters],
    queryFn: () => listAuditEvents({ tenantId: sucursalId, ...filters }),
    enabled: Boolean(sucursalId),
    placeholderData: keepPreviousData,
  });
}
