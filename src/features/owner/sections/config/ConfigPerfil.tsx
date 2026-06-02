import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../../../shared/components/ui/Input';
import { Button } from '../../../../shared/components/ui/Button';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  getEntityProfile,
  updateEntityProfile,
  type EntityProfile,
  type UpdateEntityProfileInput,
} from '../../services/entities';

interface PerfilForm {
  name: string;
  legalName: string;
  cuit: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'maintenance';
  carSpots: number;
  motorcycleSpots: number;
  bicycleSpots: number;
}

function toForm(p: EntityProfile): PerfilForm {
  return {
    name: p.name,
    legalName: p.legalName ?? '',
    cuit: p.cuit ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    address: p.address ?? '',
    status: p.status,
    carSpots: p.capacity.carSpots,
    motorcycleSpots: p.capacity.motorcycleSpots,
    bicycleSpots: p.capacity.bicycleSpots,
  };
}

export function ConfigPerfil() {
  const { showToast } = useToast();
  const { sucursalId } = useSucursal();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['entity-profile', sucursalId],
    queryFn: () => getEntityProfile(sucursalId),
    enabled: Boolean(sucursalId),
  });

  const [form, setForm] = useState<PerfilForm | null>(null);

  // Sync the editable form whenever the active lot's profile (re)loads.
  useEffect(() => {
    if (profile) setForm(toForm(profile));
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (body: UpdateEntityProfileInput) =>
      updateEntityProfile(sucursalId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['entity-profile', sucursalId],
      });
      // Name/status changes are reflected in the lot switcher.
      void queryClient.invalidateQueries({ queryKey: ['my-entities'] });
      showToast({
        message: 'Estacionamiento actualizado correctamente.',
        kind: 'success',
      });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, { endpoint: 'entities.update' }),
        kind: 'error',
      });
    },
  });

  function setField<K extends keyof PerfilForm>(
    field: K,
    value: PerfilForm[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function textHandler(field: keyof PerfilForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setField(field, e.target.value as PerfilForm[typeof field]);
  }

  function numberHandler(field: keyof PerfilForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      setField(field, (Number.isFinite(n) && n >= 0 ? n : 0) as never);
    };
  }

  function handleSave() {
    if (!form) return;
    // Build the payload, omitting fields the backend would reject when empty.
    const body: UpdateEntityProfileInput = {
      name: form.name,
      legalName: form.legalName,
      phone: form.phone,
      address: form.address,
      status: form.status,
      capacity: {
        carSpots: form.carSpots,
        motorcycleSpots: form.motorcycleSpots,
        bicycleSpots: form.bicycleSpots,
      },
    };
    const cuitDigits = form.cuit.replace(/\D/g, '');
    if (cuitDigits.length > 0) body.cuit = cuitDigits;
    if (form.email.trim().length > 0) body.email = form.email.trim();

    mutation.mutate(body);
  }

  if (isLoading || !form) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando configuración...
      </p>
    );
  }

  const busy = mutation.isPending;

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
        Datos del estacionamiento
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <Input
          label="Nombre"
          value={form.name}
          onChange={textHandler('name')}
          disabled={busy}
        />
        <Input
          label="Razón social"
          value={form.legalName}
          onChange={textHandler('legalName')}
          disabled={busy}
        />
        <Input
          label="CUIT"
          value={form.cuit}
          onChange={textHandler('cuit')}
          disabled={busy}
        />
        <Input
          label="Email de contacto"
          type="email"
          value={form.email}
          onChange={textHandler('email')}
          disabled={busy}
        />
        <Input
          label="Teléfono"
          type="tel"
          value={form.phone}
          onChange={textHandler('phone')}
          disabled={busy}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pk-label">Estado</label>
          <select
            className="pk-input"
            value={form.status}
            onChange={(e) =>
              setField('status', e.target.value as PerfilForm['status'])
            }
            disabled={busy}
          >
            <option value="active">Activo</option>
            <option value="maintenance">En mantenimiento</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input
            label="Domicilio"
            value={form.address}
            onChange={textHandler('address')}
            disabled={busy}
          />
        </div>
      </div>

      <h3
        style={{
          margin: '8px 0 0',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-1)',
        }}
      >
        Plazas por tipo
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <Input
          label="Autos"
          type="number"
          value={String(form.carSpots)}
          onChange={numberHandler('carSpots')}
          disabled={busy}
        />
        <Input
          label="Motos"
          type="number"
          value={String(form.motorcycleSpots)}
          onChange={numberHandler('motorcycleSpots')}
          disabled={busy}
        />
        <Input
          label="Bicicletas"
          type="number"
          value={String(form.bicycleSpots)}
          onChange={numberHandler('bicycleSpots')}
          disabled={busy}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 8,
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        <Button variant="primary" onClick={handleSave} loading={busy}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
