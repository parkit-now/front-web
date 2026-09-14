import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Avatar } from '../../../../shared/components/Avatar';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { fmtDateTimeAr } from '../../../../shared/utils/fmt';
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue';
import { translateApiError } from '../../../../lib/api/translate';
import { DataTable } from '../../../../features/data-table';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useSucursal } from '../../context/SucursalContext';
import { useStaffList } from '../../hooks/useStaff';
import type { StaffMember, StaffRole } from '../../services/staff';

const ROLE_LABELS: Record<'owner' | 'operator', string> = {
  owner: 'Dueño',
  operator: 'Operador',
};

export function PersonalPage() {
  const userId = useCurrentUserId();
  const { sucursalId, sucursal } = useSucursal();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'' | StaffRole>('');
  const [allBranches, setAllBranches] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useStaffList({
    search: debouncedSearch || undefined,
    role: role || undefined,
    tenantId: allBranches ? undefined : sucursalId || undefined,
    page,
    pageSize,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  const handlePaginationChange = useCallback(
    (state: { pageIndex: number; pageSize: number }) => {
      setPage(state.pageIndex + 1);
      setPageSize(state.pageSize);
    },
    [],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const columns = useMemo<ColumnDef<StaffMember, unknown>[]>(
    () => [
      {
        id: 'miembro',
        header: 'Miembro',
        accessorFn: (member) => member.name ?? member.email,
        cell: ({ row }) => {
          const member = row.original;
          // `name` es null en cuentas creadas con email/password sin nombre.
          const display = member.name ?? member.email;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={display} size={32} soft />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                  }}
                >
                  {display}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {member.email}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'roles',
        header: 'Roles por sucursal',
        accessorFn: (member) =>
          member.memberships.map((m) => m.tenantName).join(', '),
        cell: ({ row }) => (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.original.memberships.map((membership) => (
              <Badge
                key={membership.tenantId}
                variant={membership.role === 'owner' ? 'brand' : 'ok'}
              >
                {membership.tenantName} · {ROLE_LABELS[membership.role]}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'alta',
        header: 'Alta',
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {fmtDateTimeAr(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const scopeLabel = allBranches
    ? 'todas tus sucursales'
    : (sucursal?.nombre ?? 'la sucursal activa');

  if (query.isError) {
    return (
      <div>
        <SectionHeader title="Personal" />
        <div className="pk-card">
          <EmptyState
            title="No se pudo cargar el personal"
            description={translateApiError(query.error, {
              endpoint: 'staff.list',
            })}
          />
        </div>
      </div>
    );
  }

  // El alcance sale de las membresías de quien consulta, no de la URL: un admin
  // que entra a un lote ajeno no tiene membresías y recibe una lista vacía.
  const showsEmptyScopeHint =
    !query.isLoading && total === 0 && !debouncedSearch && !role;

  return (
    <div>
      <SectionHeader
        title="Personal"
        subtitle={
          total > 0
            ? `${total} ${total === 1 ? 'persona' : 'personas'} en ${scopeLabel}`
            : undefined
        }
      />

      {showsEmptyScopeHint ? (
        <div className="pk-card">
          <EmptyState
            title="No hay personal para mostrar"
            description="Este listado muestra a las personas de las sucursales de las que sos dueño. Si entraste como administrador de la plataforma, no vas a ver personal acá."
          />
        </div>
      ) : (
        <DataTable<StaffMember>
          data={items}
          columns={columns}
          isLoading={query.isLoading}
          emptyMessage="No hay personas que coincidan con la búsqueda."
          searchPlaceholder="Buscar por nombre o email"
          getRowId={(member) => member.id}
          initialPageSize={pageSize}
          serverState={{
            rowCount: total,
            isFetching: query.isFetching,
            onPaginationChange: handlePaginationChange,
            onGlobalFilterChange: handleSearchChange,
          }}
          toolbarExtra={
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <select
                className="pk-input"
                value={role}
                aria-label="Filtrar por rol"
                onChange={(event) => {
                  setRole(event.target.value as '' | StaffRole);
                  setPage(1);
                }}
                style={{ width: 150 }}
              >
                <option value="">Todos los roles</option>
                <option value="owner">Dueño</option>
                <option value="operator">Operador</option>
              </select>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--text-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={allBranches}
                  onChange={(event) => {
                    setAllBranches(event.target.checked);
                    setPage(1);
                  }}
                />
                Todas mis sucursales
              </label>
            </div>
          }
          templateScope={
            userId && sucursalId
              ? { userId, tenantId: sucursalId, tableKey: 'owner-staff' }
              : undefined
          }
        />
      )}
    </div>
  );
}
