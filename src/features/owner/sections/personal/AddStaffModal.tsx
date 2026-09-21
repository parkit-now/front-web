import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import { IconMail } from '../../../../shared/components/icons';
import { ApiError } from '../../../../lib/api/client';
import {
  readFieldErrors,
  translateApiError,
  translateValidationCode,
} from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import type { Sucursal } from '../../context/SucursalContext';
import { useStaffMutations } from '../../hooks/useStaff';
import type { StaffMembershipRole } from '../../services/staff';
import { canSubmitStaffEmail, validateStaffEmail } from './validation';

const ROLE_LABELS: Record<StaffMembershipRole, string> = {
  owner: 'Dueño',
  operator: 'Operador',
};

const ROLE_OPTIONS: StaffMembershipRole[] = ['operator', 'owner'];

function problemCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return (error.problem as { code?: string } | null)?.code;
}

interface AddStaffModalProps {
  open: boolean;
  onClose: () => void;
  branches: Sucursal[];
  /** Sucursal activa: es la que el usuario está mirando, así que va por defecto. */
  defaultBranchId: string;
}

/**
 * Alta de personal, identificando a la persona por email.
 *
 * El input es texto libre y no un desplegable a propósito: no hay ni va a haber
 * un endpoint que liste usuarios de la plataforma, porque sería dejar que
 * cualquier dueño recorra el padrón.
 *
 * Los tres errores esperables —mail sin cuenta, ya trabaja ahí, mail
 * inválido— se pintan **abajo del input** y dejan el modal abierto: son cosas
 * que el usuario corrige ahí mismo, no avisos que tenga que ir a buscar a un
 * toast después de perder lo que escribió.
 */
export function AddStaffModal({
  open,
  onClose,
  branches,
  defaultBranchId,
}: AddStaffModalProps) {
  const { showToast } = useToast();
  const { addMutation } = useStaffMutations();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [role, setRole] = useState<StaffMembershipRole>('operator');

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setEmailError(undefined);
    setBranchId(defaultBranchId);
    setRole('operator');
  }, [open, defaultBranchId]);

  const pending = addMutation.isPending;

  function handleSubmit(): void {
    const { error, email: normalized } = validateStaffEmail(email);
    setEmailError(error);
    if (!normalized) return;

    addMutation.mutate(
      { tenantId: branchId, body: { email: normalized, role } },
      {
        onSuccess: () => onClose(),
        onError: (mutationError) => {
          const code = problemCode(mutationError);

          if (code === 'USER_NOT_FOUND') {
            setEmailError(
              'No hay ninguna cuenta registrada con ese mail. La persona tiene que crearse la cuenta en Parkit primero.',
            );
            return;
          }

          if (code === 'MEMBERSHIP_ALREADY_EXISTS') {
            setEmailError('Esta persona ya trabaja en esa sucursal.');
            return;
          }

          if (code === 'VALIDATION_FAILED') {
            const emailField = readFieldErrors(mutationError).find(
              (field) => field.field === 'email',
            );
            if (emailField) {
              setEmailError(
                translateValidationCode(emailField.field, emailField.code),
              );
              return;
            }
          }

          showToast({
            message: translateApiError(mutationError, {
              endpoint: 'staff.add',
            }),
            kind: 'error',
          });
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Agregar persona"
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!canSubmitStaffEmail(email) || branchId === ''}
            onClick={handleSubmit}
          >
            {pending ? 'Agregando...' : 'Agregar'}
          </Button>
        </>
      }
    >
      <Input
        id="staff-email"
        type="email"
        label="Email"
        placeholder="ana@example.com"
        value={email}
        error={emailError}
        icon={<IconMail size={15} />}
        maxLength={255}
        required
        autoFocus
        autoComplete="off"
        onChange={(event) => {
          setEmail(event.target.value);
          if (emailError) setEmailError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && canSubmitStaffEmail(email)) {
            handleSubmit();
          }
        }}
      />
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
        La persona ya tiene que tener cuenta en Parkit: no mandamos
        invitaciones. Si todavía no se registró, pedile que cree la cuenta y
        agregala después.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flex: '1 1 200px',
            minWidth: 0,
          }}
        >
          <label htmlFor="staff-branch" className="pk-label">
            Sucursal
          </label>
          <select
            id="staff-branch"
            className="pk-input"
            value={branchId}
            disabled={pending}
            onChange={(event) => setBranchId(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.nombre}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            width: 150,
          }}
        >
          <label htmlFor="staff-role" className="pk-label">
            Rol
          </label>
          <select
            id="staff-role"
            className="pk-input"
            value={role}
            disabled={pending}
            onChange={(event) =>
              setRole(event.target.value as StaffMembershipRole)
            }
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
