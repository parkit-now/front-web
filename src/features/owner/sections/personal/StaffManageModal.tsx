import { useEffect, useState } from 'react';
import { Avatar } from '../../../../shared/components/Avatar';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import type { Sucursal } from '../../context/SucursalContext';
import { useOwnerCounts, useStaffMutations } from '../../hooks/useStaff';
import type { StaffMember, StaffMembershipRole } from '../../services/staff';
import { membershipPermissions } from './permissions';

const ROLE_LABELS: Record<StaffMembershipRole, string> = {
  owner: 'Dueño',
  operator: 'Operador',
};

const ROLE_OPTIONS: StaffMembershipRole[] = ['operator', 'owner'];

interface StaffManageModalProps {
  open: boolean;
  onClose: () => void;
  /** La persona, re-leída del listado en cada render (no la foto del click). */
  member: StaffMember;
  /** Las sucursales del usuario, para el bloque "agregar a otra". */
  branches: Sucursal[];
  currentUserId: string | null;
}

/**
 * Gestión completa de una persona: su rol en cada sucursal, sacarla de una, y
 * sumarla a otra.
 *
 * Es cross-sucursal a propósito, igual que el listado: `GET /me/staff` devuelve
 * una fila por persona con todas sus membresías, así que gestionarla sucursal
 * por sucursal obligaría a dar vueltas por el switcher. Cada control pega a
 * `/tenants/:tenantId/...` con el tenant de SU fila, no con el activo.
 *
 * Agregar a otra sucursal es un POST, no un PATCH con `tenantId`: **suma** una
 * membresía en vez de mudar la existente. La persona termina con dos badges.
 */
export function StaffManageModal({
  open,
  onClose,
  member,
  branches,
  currentUserId,
}: StaffManageModalProps) {
  const { showToast } = useToast();
  const { addMutation, updateRoleMutation, removeMutation } =
    useStaffMutations();

  const ownerCounts = useOwnerCounts(
    member.memberships.map((membership) => membership.tenantId),
  );

  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(
    null,
  );
  const [addBranchId, setAddBranchId] = useState('');
  const [addRole, setAddRole] = useState<StaffMembershipRole>('operator');

  // Cambiar de persona sin cerrar el modal no debe arrastrar una confirmación
  // a medias ni el rol que se había elegido para otro.
  useEffect(() => {
    setConfirmingRemoval(null);
    setAddBranchId('');
    setAddRole('operator');
  }, [member.id, open]);

  const isBusy =
    addMutation.isPending ||
    updateRoleMutation.isPending ||
    removeMutation.isPending;

  const displayName = member.name ?? member.email;

  const availableBranches = branches.filter(
    (branch) =>
      !member.memberships.some(
        (membership) => membership.tenantId === branch.id,
      ),
  );

  // Derivado en vez de sincronizado con un efecto: al sumar una sucursal, la
  // elegida desaparece de la lista y el select cae solo en la siguiente.
  const selectedBranchId =
    availableBranches.find((branch) => branch.id === addBranchId)?.id ??
    availableBranches[0]?.id ??
    '';

  function toastError(
    error: unknown,
    endpoint: 'staff.update' | 'staff.remove' | 'staff.add',
  ) {
    showToast({
      message: translateApiError(error, { endpoint }),
      kind: 'error',
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isBusy) onClose();
      }}
      title="Gestionar persona"
      width={600}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={isBusy}>
          Cerrar
        </Button>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <Avatar name={displayName} size={40} soft />
        <div style={{ minWidth: 0 }}>
          <div
            style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}
          >
            {displayName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {member.email}
          </div>
        </div>
      </div>

      <h3
        style={{
          margin: '20px 0 10px',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-3)',
        }}
      >
        Sucursales
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {member.memberships.map((membership) => {
          const permissions = membershipPermissions({
            memberId: member.id,
            currentUserId,
            membership,
            ownerCount: ownerCounts[membership.tenantId],
          });
          const isConfirming = confirmingRemoval === membership.tenantId;

          return (
            <div
              key={membership.tenantId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-soft)',
                background: 'var(--surface-2)',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-1)',
                  minWidth: 0,
                }}
              >
                {membership.tenantName}
              </span>

              {isConfirming ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    ¿Sacarla de esta sucursal?
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate(
                        {
                          tenantId: membership.tenantId,
                          userId: member.id,
                          tenantName: membership.tenantName,
                        },
                        {
                          onSuccess: () => setConfirmingRemoval(null),
                          onError: (error) => toastError(error, 'staff.remove'),
                        },
                      )
                    }
                  >
                    Sí, sacar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => setConfirmingRemoval(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    className="pk-input"
                    value={membership.role}
                    aria-label={`Rol en ${membership.tenantName}`}
                    title={permissions.reason}
                    disabled={!permissions.canChangeRole || isBusy}
                    style={{ width: 140 }}
                    onChange={(event) => {
                      const role = event.target.value as StaffMembershipRole;
                      // El PATCH es idempotente, pero un body que no cambia
                      // nada es una request al pedo y un toast confuso.
                      if (role === membership.role) return;
                      updateRoleMutation.mutate(
                        {
                          tenantId: membership.tenantId,
                          userId: member.id,
                          role,
                        },
                        {
                          onError: (error) => toastError(error, 'staff.update'),
                        },
                      );
                    }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={permissions.reason}
                    disabled={!permissions.canRemove || isBusy}
                    onClick={() => setConfirmingRemoval(membership.tenantId)}
                  >
                    Sacar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {availableBranches.length > 0 && (
        <>
          <h3
            style={{
              margin: '24px 0 4px',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-3)',
            }}
          >
            Agregar a otra sucursal
          </h3>
          <p
            style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-3)' }}
          >
            Suma una sucursal más: sigue trabajando en las que ya tiene.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <select
              className="pk-input"
              value={selectedBranchId}
              aria-label="Sucursal a agregar"
              disabled={isBusy}
              style={{ flex: '1 1 200px', minWidth: 0 }}
              onChange={(event) => setAddBranchId(event.target.value)}
            >
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.nombre}
                </option>
              ))}
            </select>
            <select
              className="pk-input"
              value={addRole}
              aria-label="Rol en la sucursal a agregar"
              disabled={isBusy}
              style={{ width: 140 }}
              onChange={(event) =>
                setAddRole(event.target.value as StaffMembershipRole)
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              loading={addMutation.isPending}
              disabled={isBusy || selectedBranchId === ''}
              onClick={() =>
                addMutation.mutate(
                  {
                    tenantId: selectedBranchId,
                    body: { email: member.email, role: addRole },
                  },
                  { onError: (error) => toastError(error, 'staff.add') },
                )
              }
            >
              Sumar
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
