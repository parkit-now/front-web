import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../shared/components/ui/Button';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  getEntityProfile,
  updateEntityProfile,
  LPR_IMAGE_RETENTION_DAYS_OPTIONS,
  LPR_IMAGE_RETENTION_DAYS_DEFAULT,
  type LprImageRetentionDays,
} from '../../services/entities';

export function ConfigRetencion() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canEdit = sucursal?.role === 'owner';

  const queryKey = ['entity-profile', sucursalId];
  const { data: profile, isLoading } = useQuery({
    queryKey,
    queryFn: () => getEntityProfile(sucursalId),
    enabled: Boolean(sucursalId),
  });

  // Editable copy of the retention window, synced from the server value.
  const [days, setDays] = useState<LprImageRetentionDays>(
    LPR_IMAGE_RETENTION_DAYS_DEFAULT,
  );
  useEffect(() => {
    if (profile) setDays(profile.lprImageRetentionDays);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (value: LprImageRetentionDays) =>
      updateEntityProfile(sucursalId, { lprImageRetentionDays: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      showToast({
        message: 'Política de retención actualizada.',
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

  // A closed set of options selected via <select>: always a valid value by
  // construction, nothing to validate beyond whether it changed.
  const dirty = profile !== undefined && days !== profile.lprImageRetentionDays;

  function handleSave() {
    if (!canEdit || !dirty) return;
    mutation.mutate(days);
  }

  if (isLoading || !profile) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando configuración...
      </p>
    );
  }

  const busy = mutation.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Retención de imágenes de patentes
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--text-3)',
            maxWidth: 560,
          }}
        >
          Cuántos días se conserva la foto de un ingreso registrado después de
          que el vehículo egresa. Pasado ese plazo, la limpieza automática
          elimina la imagen del almacenamiento y el evento queda sin foto
          (patente, fechas y monto se conservan). Ayuda a cumplir con la Ley
          25.326 de protección de datos personales.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label className="pk-label" htmlFor="lpr-retention-days">
          Días de retención (eventos registrados)
        </label>
        <select
          id="lpr-retention-days"
          className="pk-input"
          style={{ width: 160 }}
          value={days}
          disabled={!canEdit || busy}
          onChange={(e) =>
            setDays(Number(e.target.value) as LprImageRetentionDays)
          }
        >
          {LPR_IMAGE_RETENTION_DAYS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} días
              {option === LPR_IMAGE_RETENTION_DAYS_DEFAULT
                ? ' (por defecto)'
                : ''}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Por defecto {LPR_IMAGE_RETENTION_DAYS_DEFAULT} días.
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
        Los eventos descartados o archivados usan una política interna corta y
        fija, independiente de este valor.
      </p>

      {canEdit && (
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
            onClick={handleSave}
            loading={busy}
            disabled={!dirty}
          >
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}
