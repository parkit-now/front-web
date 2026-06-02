import { useState } from 'react';
import { Avatar } from '../../../../shared/components/Avatar';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Pagination } from '../../../../shared/components/ui/Pagination';
import { IconSearch } from '../../../../shared/components/icons';
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue';
import { useUsersList } from '../../hooks/useUsers';
import type { AdminUser } from '../../services/users';
import { UserDetailDrawer } from './UserDetailDrawer';

const PAGE_SIZE = 20;

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-3)',
  borderBottom: '1px solid var(--border-soft)',
  whiteSpace: 'nowrap',
};

function roleBadge(role: AdminUser['role']) {
  return role === 'admin' ? (
    <Badge variant="brand">Administrador</Badge>
  ) : (
    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Usuario</span>
  );
}

export function UsuariosPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useUsersList({ search, page, pageSize: PAGE_SIZE });
  const data = listQuery.data;
  const items = data?.items ?? [];

  function handleSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  return (
    <div className="pk-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Usuarios y roles
        </h2>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <Input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nombre o email"
            icon={<IconSearch size={15} />}
            aria-label="Buscar usuarios"
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto', minHeight: 200 }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-b)' }}>
              {['Usuario', 'Rol global', ''].map((col, i) => (
                <th
                  key={col || `col-${i}`}
                  style={{ ...thStyle, textAlign: i === 2 ? 'right' : 'left' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: 24, color: 'var(--text-2)', fontSize: 14 }}
                >
                  Cargando usuarios…
                </td>
              </tr>
            ) : listQuery.isError ? (
              <tr>
                <td colSpan={3} style={{ padding: 24 }}>
                  <p
                    style={{
                      margin: '0 0 8px',
                      color: 'var(--text-2)',
                      fontSize: 14,
                    }}
                  >
                    No pudimos cargar los usuarios.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void listQuery.refetch()}
                  >
                    Reintentar
                  </Button>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: 24, color: 'var(--text-2)', fontSize: 14 }}
                >
                  {search
                    ? 'No hay usuarios que coincidan con la búsqueda.'
                    : 'No hay usuarios para mostrar.'}
                </td>
              </tr>
            ) : (
              items.map((user, idx) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom:
                      idx < items.length - 1
                        ? '1px solid var(--border-soft)'
                        : 'none',
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
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
                  <td style={{ padding: '12px 16px' }}>
                    {roleBadge(user.role)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedId(user.id)}
                    >
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      <UserDetailDrawer
        userId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
