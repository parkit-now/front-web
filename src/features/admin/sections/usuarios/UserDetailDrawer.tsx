import { useMemo, useState } from 'react';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Combobox } from '../../../../shared/components/ui/Combobox';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue';
import { useParkingsList } from '../../hooks/useParkings';
import {
  useMembershipActions,
  useUserActions,
  useUserDetail,
} from '../../hooks/useUsers';
import type { Parking } from '../../services/parkings';
import type { MembershipRole, UserRole } from '../../services/users';

interface UserDetailDrawerProps {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

const sectionLabel: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
};

function roleLabel(role: MembershipRole): string {
  return role === 'owner' ? 'Dueño' : 'Operador';
}

export function UserDetailDrawer({
  userId,
  open,
  onClose,
}: UserDetailDrawerProps) {
  const detailQuery = useUserDetail(open ? userId : null);
  const { updateRoleMutation, deleteMutation } = useUserActions();
  const { addMutation, updateMutation, removeMutation } =
    useMembershipActions();

  const user = detailQuery.data ?? null;

  // Add-membership form state.
  const [parkingQuery, setParkingQuery] = useState('');
  const debouncedQuery = useDebouncedValue(parkingQuery, 300);
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const [newRole, setNewRole] = useState<MembershipRole>('operator');

  const [confirmDelete, setConfirmDelete] = useState(false);

  const parkingSearch = useParkingsList({
    search: debouncedQuery,
    page: 1,
    pageSize: 8,
  });

  // Hide parkings the user is already linked to.
  const linkedIds = useMemo(
    () => new Set((user?.memberships ?? []).map((m) => m.parkingId)),
    [user],
  );
  const parkingOptions = (parkingSearch.data?.items ?? []).filter(
    (p) => !linkedIds.has(p.id),
  );

  function handleAddMembership() {
    if (!userId || !selectedParking) return;
    addMutation.mutate(
      { userId, body: { parkingId: selectedParking.id, role: newRole } },
      {
        onSuccess: () => {
          setSelectedParking(null);
          setParkingQuery('');
          setNewRole('operator');
        },
      },
    );
  }

  function handleDeleteUser() {
    if (!userId) return;
    deleteMutation.mutate(userId, {
      onSuccess: () => {
        setConfirmDelete(false);
        onClose();
      },
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Detalle de usuario"
      width={520}
    >
      {detailQuery.isLoading ? (
        <p style={{ padding: 24, color: 'var(--text-2)', fontSize: 14 }}>
          Cargando usuario…
        </p>
      ) : !user ? (
        <p style={{ padding: 24, color: 'var(--text-2)', fontSize: 14 }}>
          No pudimos cargar el usuario.
        </p>
      ) : (
        <div
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* Identity */}
          <section>
            <h3
              style={{
                margin: '0 0 2px',
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-1)',
              }}
            >
              {user.name ?? user.email}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
              {user.email}
            </p>
          </section>

          {/* Global role */}
          <section>
            <p style={sectionLabel}>Rol global</p>
            <select
              className="pk-input"
              value={user.role}
              disabled={updateRoleMutation.isPending}
              onChange={(e) =>
                updateRoleMutation.mutate({
                  id: user.id,
                  role: e.target.value as UserRole,
                })
              }
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: 'var(--text-3)',
              }}
            >
              Un administrador accede a todo el sistema. Un usuario solo a los
              estacionamientos que tenga asignados.
            </p>
          </section>

          {/* Memberships */}
          <section>
            <p style={sectionLabel}>Estacionamientos asignados</p>
            {user.memberships.length === 0 ? (
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: 13,
                  color: 'var(--text-2)',
                }}
              >
                Este usuario no está vinculado a ningún estacionamiento.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {user.memberships.map((m) => (
                  <div
                    key={m.parkingId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: '1px solid var(--border-soft)',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.parkingName}
                    </span>
                    <select
                      className="pk-input"
                      style={{ width: 130, flexShrink: 0 }}
                      value={m.role}
                      disabled={
                        updateMutation.isPending || removeMutation.isPending
                      }
                      onChange={(e) =>
                        updateMutation.mutate({
                          userId: user.id,
                          parkingId: m.parkingId,
                          role: e.target.value as MembershipRole,
                        })
                      }
                    >
                      <option value="operator">Operador</option>
                      <option value="owner">Dueño</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removeMutation.isPending}
                      onClick={() =>
                        removeMutation.mutate({
                          userId: user.id,
                          parkingId: m.parkingId,
                        })
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add membership */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                background: 'var(--bg-b)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                Agregar estacionamiento
              </p>
              {selectedParking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge variant="brand">{selectedParking.name}</Badge>
                  <button
                    type="button"
                    className="pk-btn pk-btn-ghost pk-btn-sm"
                    onClick={() => {
                      setSelectedParking(null);
                      setParkingQuery('');
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <Combobox<Parking>
                  query={parkingQuery}
                  onQueryChange={setParkingQuery}
                  items={parkingOptions}
                  loading={parkingSearch.isFetching}
                  onSelect={(p) => {
                    setSelectedParking(p);
                    setParkingQuery(p.name);
                  }}
                  getKey={(p) => p.id}
                  getLabel={(p) => p.name}
                  getSecondary={(p) => p.address}
                  placeholder="Buscar estacionamiento…"
                  emptyMessage="No hay estacionamientos disponibles."
                />
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="pk-input"
                  style={{ width: 150 }}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as MembershipRole)}
                >
                  <option value="operator">Operador</option>
                  <option value="owner">Dueño</option>
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!selectedParking}
                  loading={addMutation.isPending}
                  onClick={handleAddMembership}
                >
                  Agregar como {roleLabel(newRole).toLowerCase()}
                </Button>
              </div>
            </div>
          </section>

          {/* Danger zone */}
          <section
            style={{
              borderTop: '1px solid var(--border-soft)',
              paddingTop: 16,
            }}
          >
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar usuario
            </Button>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar usuario"
        destructive
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteUser}
        onClose={() => setConfirmDelete(false)}
        message={
          <>
            ¿Seguro que querés eliminar a{' '}
            <strong>{user?.name ?? user?.email}</strong>? Se eliminará su cuenta
            por completo y todos sus vínculos con estacionamientos. Esta acción
            no se puede deshacer.
          </>
        }
      />
    </Drawer>
  );
}
