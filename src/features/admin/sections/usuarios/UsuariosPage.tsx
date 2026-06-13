import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Avatar } from '../../../../shared/components/Avatar';
import { Badge } from '../../../../shared/components/ui/Badge';
import { IconPencil } from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useUsersList } from '../../hooks/useUsers';
import type { AdminUser } from '../../services/users';
import { UserDetailDrawer } from './UserDetailDrawer';

// Client-side table: fetch a large page and let DataTable own search, sorting,
// filtering, pagination and the saved view templates.
const FETCH_PAGE_SIZE = 100;

function roleBadge(role: AdminUser['role']) {
  return role === 'admin' ? (
    <Badge variant="brand">Administrador</Badge>
  ) : (
    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Usuario</span>
  );
}

export function UsuariosPage() {
  const userId = useCurrentUserId();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useUsersList({ pageSize: FETCH_PAGE_SIZE });
  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  const columns = useMemo<ColumnDef<AdminUser, unknown>[]>(
    () => [
      {
        id: 'usuario',
        header: 'Usuario',
        accessorFn: (user) => user.name ?? user.email,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={user.name ?? user.email} size={32} soft />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                  }}
                >
                  {user.name ?? '—'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
                  {user.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: 'role',
        header: 'Rol global',
        accessorKey: 'role',
        cell: ({ row }) => roleBadge(row.original.role),
      },
      {
        id: 'acciones',
        header: () => <div style={{ textAlign: 'center' }}>Acciones</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="pk-btn pk-btn-ghost pk-btn-icon"
                title="Editar roles"
                aria-label={`Editar roles de ${user.name ?? user.email}`}
                onClick={() => setSelectedId(user.id)}
              >
                <IconPencil size={16} />
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <DataTable<AdminUser>
        data={items}
        columns={columns}
        title="Usuarios y roles"
        isLoading={listQuery.isLoading}
        emptyMessage="No hay usuarios para mostrar."
        searchPlaceholder="Buscar por nombre o email"
        searchableKeys={['name', 'email']}
        filterableColumns={['role']}
        filterOptionsByColumn={{
          role: [
            { value: 'admin', label: 'Administrador' },
            { value: 'user', label: 'Usuario' },
          ],
        }}
        getRowId={(user) => user.id}
        initialPageSize={20}
        templateScope={
          userId
            ? { userId, tenantId: 'admin', tableKey: 'admin-users' }
            : undefined
        }
        onRefresh={() => void listQuery.refetch()}
        refreshDisabled={listQuery.isFetching}
      />

      <UserDetailDrawer
        userId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
