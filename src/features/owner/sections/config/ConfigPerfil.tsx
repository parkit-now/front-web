import { useState } from 'react';
import { Input } from '../../../../shared/components/ui/Input';
import { Button } from '../../../../shared/components/ui/Button';
import { useToast } from '../../../../lib/notifications/ToastProvider';

interface PerfilForm {
  razonSocial: string;
  cuit: string;
  email: string;
  telefono: string;
  domicilio: string;
}

const INITIAL: PerfilForm = {
  razonSocial: 'Estacionamientos del Sur S.A.',
  cuit: '30-71234567-8',
  email: 'admin@estacionamientodelsur.com.ar',
  telefono: '+54 11 4821-3300',
  domicilio: 'Av. Corrientes 1234, CABA',
};

export function ConfigPerfil() {
  const { showToast } = useToast();
  const [form, setForm] = useState<PerfilForm>(INITIAL);
  const [loading, setLoading] = useState(false);

  function handleChange(field: keyof PerfilForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSave() {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 800));
    setLoading(false);
    showToast({
      message: 'Perfil actualizado correctamente.',
      kind: 'success',
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-1)',
        }}
      >
        Perfil del estacionamiento
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <Input
          label="Razón social"
          value={form.razonSocial}
          onChange={handleChange('razonSocial')}
          disabled={loading}
        />
        <Input
          label="CUIT"
          value={form.cuit}
          onChange={handleChange('cuit')}
          disabled={loading}
        />
        <Input
          label="Email de contacto"
          type="email"
          value={form.email}
          onChange={handleChange('email')}
          disabled={loading}
        />
        <Input
          label="Teléfono"
          type="tel"
          value={form.telefono}
          onChange={handleChange('telefono')}
          disabled={loading}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Domicilio fiscal"
            value={form.domicilio}
            onChange={handleChange('domicilio')}
            disabled={loading}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 8,
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          loading={loading}
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
