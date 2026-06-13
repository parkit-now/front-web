import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PERSONAL } from '../../../../mock/personal';
import type { PersonalMember } from '../../../../types/api';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Avatar } from '../../../../shared/components/Avatar';
import { IconPlus } from '../../../../shared/components/icons';
import { DataTable } from '../../../../features/data-table';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useSucursal } from '../../context/SucursalContext';
import { InviteModal } from './InviteModal';

function roleBadgeVariant(rol: string): 'brand' | 'warn' | 'ok' | 'default' {
  if (rol === 'Administrador') return 'brand';
  if (rol === 'Supervisor') return 'warn';
  return 'ok';
}

export function PersonalPage() {
  const userId = useCurrentUserId();
  const { sucursalId } = useSucursal();
  const [inviteOpen, setInviteOpen] = useState(false);

  const members = useMemo(() => PERSONAL, []);

  const columns = useMemo<ColumnDef<PersonalMember, unknown>[]>(
    () => [
      {
        id: 'miembro',
        header: 'Miembro',
        accessorFn: (member) => member.nombre,
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={member.nombre} size={32} soft />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                  }}
                >
                  {member.nombre}
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
        id: 'rol',
        header: 'Rol',
        accessorKey: 'rol',
        cell: ({ row }) => (
          <Badge variant={roleBadgeVariant(row.original.rol)}>
            {row.original.rol}
          </Badge>
        ),
      },
      {
        id: 'sucursal',
        header: 'Sucursal',
        accessorKey: 'sucursal',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {row.original.sucursal}
          </span>
        ),
      },
      {
        id: 'actividad_label',
        header: 'Última actividad',
        accessorKey: 'actividad_label',
        cell: ({ row }) => (
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {row.original.actividad_label}
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorKey: 'estado',
        cell: ({ row }) => (
          <Badge
            variant={row.original.estado === 'active' ? 'ok' : 'default'}
            dot
          >
            {row.original.estado === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Personal"
        subtitle={`${PERSONAL.length} miembros en total`}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<IconPlus size={15} />}
            onClick={() => setInviteOpen(true)}
          >
            Invitar miembro
          </Button>
        }
      />

      <DataTable<PersonalMember>
        data={members}
        columns={columns}
        emptyMessage="No hay miembros para mostrar."
        searchPlaceholder="Buscar por nombre o email"
        searchableKeys={['nombre', 'email', 'sucursal']}
        filterableColumns={['rol', 'estado']}
        filterOptionsByColumn={{
          rol: [
            { value: 'Administrador', label: 'Administrador' },
            { value: 'Supervisor', label: 'Supervisor' },
            { value: 'Operador de rampa', label: 'Operador de rampa' },
          ],
          estado: [
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
          ],
        }}
        getRowId={(member) => member.id}
        initialPageSize={10}
        templateScope={
          userId && sucursalId
            ? { userId, tenantId: sucursalId, tableKey: 'owner-staff' }
            : undefined
        }
      />

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
