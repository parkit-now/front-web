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

/** What each per-parking role can do — shown in the confirmation dialog. */
const ROLE_BLURB: Record<MembershipRole, string> = {
  operator:
    'Opera el día a día (ingresos y egresos), sin modificar la configuración ni las tarifas.',
  owner:
    'Administra el estacionamiento: perfil, tarifas, métodos de pago y zonas.',
};

/**
 * A pending privileged action awaiting confirmation. Role/access changes are
 * explicit, named actions guarded by a confirm dialog (industry pattern), not
 * silent dropdown edits.
 */
type PendingAction =
  | { kind: 'globalRole'; nextRole: UserRole }
  | { kind: 'addMembership'; parking: Parking; role: MembershipRole }
  | {
      kind: 'changeMembership';
      parkingId: string;
      parkingName: string;
      nextRole: MembershipRole;
    }
  | { kind: 'removeMembership'; parkingId: string; parkingName: string }
  | { kind: 'deleteUser' };

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

  const [pending, setPending] = useState<PendingAction | null>(null);
  const closePending = () => setPending(null);

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

  const displayName = user?.name ?? user?.email ?? '';

  function resetAddForm() {
    setSelectedParking(null);
    setParkingQuery('');
  }

  /** Maps the pending action to dialog copy + the mutation that runs it. */
  function confirmProps() {
    if (!pending || !user) return null;
    const strong = (text: string) => <strong>{text}</strong>;

    switch (pending.kind) {
      case 'globalRole': {
        const toAdmin = pending.nextRole === 'admin';
        return {
          title: toAdmin ? 'Ascender a administrador' : 'Pasar a usuario',
          confirmLabel: toAdmin ? 'Ascender' : 'Pasar a usuario',
          destructive: !toAdmin,
          loading: updateRoleMutation.isPending,
          message: toAdmin ? (
            <>
              ¿Ascender a {strong(displayName)} a administrador? Tendrá acceso
              completo a todo el sistema y a todos los estacionamientos, sin
              necesidad de asignaciones.
            </>
          ) : (
            <>
              ¿Quitarle el rol de administrador a {strong(displayName)}? Pasará
              a acceder solo a los estacionamientos que tenga asignados.
            </>
          ),
          onConfirm: () =>
            updateRoleMutation.mutate(
              { id: user.id, role: pending.nextRole },
              { onSuccess: closePending },
            ),
        };
      }
      case 'addMembership':
        return {
          title: 'Asignar estacionamiento',
          confirmLabel: `Asignar como ${roleLabel(pending.role).toLowerCase()}`,
          destructive: false,
          loading: addMutation.isPending,
          message: (
            <>
              ¿Asignar a {strong(displayName)} como{' '}
              {strong(roleLabel(pending.role).toLowerCase())} en{' '}
              {strong(pending.parking.name)}? {ROLE_BLURB[pending.role]}
            </>
          ),
          onConfirm: () =>
            addMutation.mutate(
              {
                userId: user.id,
                body: { parkingId: pending.parking.id, role: pending.role },
              },
              {
                onSuccess: () => {
                  resetAddForm();
                  closePending();
                },
              },
            ),
        };
      case 'changeMembership':
        return {
          title: 'Cambiar rol',
          confirmLabel: `Pasar a ${roleLabel(pending.nextRole).toLowerCase()}`,
          destructive: false,
          loading: updateMutation.isPending,
          message: (
            <>
              ¿Cambiar el rol de {strong(displayName)} en{' '}
              {strong(pending.parkingName)} a{' '}
              {strong(roleLabel(pending.nextRole).toLowerCase())}?{' '}
              {ROLE_BLURB[pending.nextRole]}
            </>
          ),
          onConfirm: () =>
            updateMutation.mutate(
              {
                userId: user.id,
                parkingId: pending.parkingId,
                role: pending.nextRole,
              },
              { onSuccess: closePending },
            ),
        };
      case 'removeMembership':
        return {
          title: 'Quitar estacionamiento',
          confirmLabel: 'Quitar',
          destructive: true,
          loading: removeMutation.isPending,
          message: (
            <>
              ¿Quitar el acceso de {strong(displayName)} a{' '}
              {strong(pending.parkingName)}? Dejará de poder operar o
              administrar ese estacionamiento.
            </>
          ),
          onConfirm: () =>
            removeMutation.mutate(
              { userId: user.id, parkingId: pending.parkingId },
              { onSuccess: closePending },
            ),
        };
      case 'deleteUser':
        return {
          title: 'Eliminar usuario',
          confirmLabel: 'Eliminar',
          destructive: true,
          loading: deleteMutation.isPending,
          message: (
            <>
              ¿Seguro que querés eliminar a {strong(displayName)}? Se eliminará
              su cuenta por completo y todos sus vínculos con estacionamientos.
              Esta acción no se puede deshacer.
            </>
          ),
          onConfirm: () =>
            deleteMutation.mutate(user.id, {
              onSuccess: () => {
                closePending();
                onClose();
              },
            }),
        };
    }
  }

  const confirm = confirmProps();

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge variant={user.role === 'admin' ? 'brand' : 'default'}>
                {user.role === 'admin' ? 'Administrador' : 'Usuario'}
              </Badge>
              {user.role === 'admin' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={updateRoleMutation.isPending}
                  onClick={() =>
                    setPending({ kind: 'globalRole', nextRole: 'user' })
                  }
                >
                  Pasar a usuario
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={updateRoleMutation.isPending}
                  onClick={() =>
                    setPending({ kind: 'globalRole', nextRole: 'admin' })
                  }
                >
                  Ascender a administrador
                </Button>
              )}
            </div>
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
                {user.memberships.map((m) => {
                  const otherRole: MembershipRole =
                    m.role === 'owner' ? 'operator' : 'owner';
                  return (
                    <div
                      key={m.parkingId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: '12px 14px',
                        background: 'var(--bg-b)',
                        border: '1px solid var(--border-soft)',
                        borderRadius: 'var(--r-md)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
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
                        <Badge
                          variant={m.role === 'owner' ? 'brand' : 'default'}
                        >
                          {roleLabel(m.role)}
                        </Badge>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: 8,
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPending({
                              kind: 'changeMembership',
                              parkingId: m.parkingId,
                              parkingName: m.parkingName,
                              nextRole: otherRole,
                            })
                          }
                        >
                          Pasar a {roleLabel(otherRole).toLowerCase()}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPending({
                              kind: 'removeMembership',
                              parkingId: m.parkingId,
                              parkingName: m.parkingName,
                            })
                          }
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add membership */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
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
                    onClick={resetAddForm}
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
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  disabled={!selectedParking}
                  onClick={() =>
                    selectedParking &&
                    setPending({
                      kind: 'addMembership',
                      parking: selectedParking,
                      role: 'operator',
                    })
                  }
                >
                  Operador
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  disabled={!selectedParking}
                  onClick={() =>
                    selectedParking &&
                    setPending({
                      kind: 'addMembership',
                      parking: selectedParking,
                      role: 'owner',
                    })
                  }
                >
                  Dueño
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
              onClick={() => setPending({ kind: 'deleteUser' })}
            >
              Eliminar usuario
            </Button>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        destructive={confirm?.destructive}
        confirmLabel={confirm?.confirmLabel}
        loading={confirm?.loading}
        onConfirm={() => confirm?.onConfirm()}
        onClose={closePending}
        message={confirm?.message ?? ''}
      />
    </Drawer>
  );
}
