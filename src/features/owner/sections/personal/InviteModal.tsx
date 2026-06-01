import { useState } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal';
import { Input } from '../../../../shared/components/ui/Input';
import { Button } from '../../../../shared/components/ui/Button';
import { SUCURSALES } from '../../../../mock/sucursales';
import { useToast } from '../../../../lib/notifications/ToastProvider';

const ROLES = ['Administrador', 'Supervisor', 'Operador de rampa'] as const;

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteModal({ open, onClose }: InviteModalProps) {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<string>(ROLES[0]);
  const [sucursalId, setSucursalId] = useState(SUCURSALES[0].id);
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setEmail('');
    setRol(ROLES[0]);
    setSucursalId(SUCURSALES[0].id);
    onClose();
  }

  async function handleConfirm() {
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((res) => setTimeout(res, 800));
    setLoading(false);
    showToast({
      message: `Invitación enviada a ${email} como ${rol}.`,
      kind: 'success',
    });
    handleClose();
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose} disabled={loading}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        onClick={() => void handleConfirm()}
        loading={loading}
        disabled={!email.trim()}
      >
        Enviar invitación
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Invitar miembro"
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Email"
          type="email"
          placeholder="nombre@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pk-label">Rol</label>
          <select
            className="pk-input"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            disabled={loading}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pk-label">Sucursal</label>
          <select
            className="pk-input"
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            disabled={loading}
          >
            {SUCURSALES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
