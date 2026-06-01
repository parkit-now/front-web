import { useState } from 'react';
import { USUARIOS_ADMIN } from '../../../../mock/admin';
import type { UsuarioAdmin } from '../../../../types/api';
import { Avatar } from '../../../../shared/components/Avatar';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { useToast } from '../../../../lib/notifications/ToastProvider';

export function UsuariosPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UsuarioAdmin[]>(USUARIOS_ADMIN);

  function handleToggle(user: UsuarioAdmin) {
    const action = user.estado === 'active' ? 'suspended' : 'active';
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, estado: action } : u)),
    );
    showToast({
      message:
        action === 'suspended'
          ? `Usuario ${user.nombre} suspendido.`
          : `Usuario ${user.nombre} reactivado.`,
      kind: 'success',
    });
  }

  return (
    <div className="pk-card" style={{ overflow: 'hidden' }}>
      {/* Table header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
            flex: 1,
          }}
        >
          Usuarios del sistema
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {users.length} usuarios
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-b)' }}>
              {[
                'Usuario',
                'Rol',
                'Empresa',
                'Último acceso',
                'Estado',
                'Acción',
              ].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-3)',
                    borderBottom: '1px solid var(--border-soft)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr
                key={user.id}
                style={{
                  borderBottom:
                    idx < users.length - 1
                      ? '1px solid var(--border-soft)'
                      : 'none',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-b)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                {/* Avatar + name + email */}
                <td style={{ padding: '12px 16px' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <Avatar name={user.nombre} size={32} soft />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-1)',
                        }}
                      >
                        {user.nombre}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: 'var(--text-3)',
                        }}
                      >
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Rol */}
                <td style={{ padding: '12px 16px' }}>
                  {user.es_interno ? (
                    <Badge variant="brand">{user.rol}</Badge>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {user.rol}
                    </span>
                  )}
                </td>

                {/* Empresa */}
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {user.empresa ?? '—'}
                  </span>
                </td>

                {/* Último acceso */}
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {user.ultimo_acceso_label}
                  </span>
                </td>

                {/* Estado */}
                <td style={{ padding: '12px 16px' }}>
                  {user.estado === 'active' ? (
                    <Badge variant="ok" dot>
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="err" dot>
                      Suspendido
                    </Badge>
                  )}
                </td>

                {/* Acción */}
                <td style={{ padding: '12px 16px' }}>
                  {!user.es_interno ? (
                    <Button
                      variant={
                        user.estado === 'active' ? 'danger' : 'secondary'
                      }
                      size="sm"
                      onClick={() => handleToggle(user)}
                    >
                      {user.estado === 'active' ? 'Suspender' : 'Reactivar'}
                    </Button>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
