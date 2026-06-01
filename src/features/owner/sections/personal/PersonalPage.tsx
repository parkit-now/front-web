import { useState } from 'react';
import { PERSONAL } from '../../../../mock/personal';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Avatar } from '../../../../shared/components/Avatar';
import { IconPlus } from '../../../../shared/components/icons';
import { InviteModal } from './InviteModal';

const ALL_ROLES = [
  'Todos',
  'Administrador',
  'Supervisor',
  'Operador de rampa',
] as const;
type RoleFilter = (typeof ALL_ROLES)[number];

function roleBadgeVariant(rol: string): 'brand' | 'warn' | 'ok' | 'default' {
  if (rol === 'Administrador') return 'brand';
  if (rol === 'Supervisor') return 'warn';
  return 'ok';
}

export function PersonalPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('Todos');
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = PERSONAL.filter((p) =>
    roleFilter === 'Todos' ? true : p.rol === roleFilter,
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

      {/* Role filter chips */}
      <div
        style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}
      >
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            style={{
              padding: '5px 14px',
              borderRadius: 999,
              border: '1px solid',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms',
              borderColor: roleFilter === r ? 'var(--brand)' : 'var(--border)',
              background:
                roleFilter === r ? 'var(--brand-soft)' : 'transparent',
              color: roleFilter === r ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="pk-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
              {['Miembro', 'Rol', 'Sucursal', 'Última actividad', 'Estado'].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((member, i) => (
              <tr
                key={member.id}
                style={{
                  borderBottom:
                    i < filtered.length - 1
                      ? '1px solid var(--border-soft)'
                      : 'none',
                }}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
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
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge variant={roleBadgeVariant(member.rol)}>
                    {member.rol}
                  </Badge>
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    color: 'var(--text-2)',
                  }}
                >
                  {member.sucursal}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    color: 'var(--text-3)',
                  }}
                >
                  {member.actividad_label}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge
                    variant={member.estado === 'active' ? 'ok' : 'default'}
                    dot
                  >
                    {member.estado === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
