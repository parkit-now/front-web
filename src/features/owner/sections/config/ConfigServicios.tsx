import { useEffect, useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../shared/components/ui/Button';
import { Switch } from '../../../../shared/components/ui/Switch';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  listServices,
  updateService,
  type ServiceCode,
  type UpdateServiceInput,
} from '../../services/services';

const SERVICE_LABELS: Record<ServiceCode, string> = {
  ADVANCE_RESERVATION: 'Reserva anticipada',
  VEHICLE_CAR: 'Autos',
  VEHICLE_BICYCLE: 'Bicicletas',
  VEHICLE_MOTORCYCLE: 'Motos',
  VEHICLE_PICKUP: 'Camionetas',
  VEHICLE_TRUCK: 'Camiones',
};

const VEHICLE_CODES: ServiceCode[] = [
  'VEHICLE_CAR',
  'VEHICLE_MOTORCYCLE',
  'VEHICLE_BICYCLE',
  'VEHICLE_PICKUP',
  'VEHICLE_TRUCK',
];

export function ConfigServicios() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canEdit = sucursal?.role === 'owner';

  const queryKey = ['services', sucursalId];
  const { data: services = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listServices(sucursalId),
    enabled: Boolean(sucursalId),
  });

  const byCode = new Map(services.map((s) => [s.code, s]));

  // Editable spot inputs, keyed by vehicle code, synced from the server.
  const [spotInputs, setSpotInputs] = useState<Record<string, string>>({});
  useEffect(() => {
    setSpotInputs(
      Object.fromEntries(services.map((s) => [s.code, String(s.spots)])),
    );
  }, [services]);

  const mutation = useMutation({
    mutationFn: ({
      code,
      body,
    }: {
      code: ServiceCode;
      body: UpdateServiceInput;
    }) => updateService(sucursalId, code, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, { endpoint: 'services.toggle' }),
        kind: 'error',
      });
    },
  });

  function isEnabled(code: ServiceCode): boolean {
    return byCode.get(code)?.enabled ?? false;
  }

  function serverSpots(code: ServiceCode): number {
    return byCode.get(code)?.spots ?? 0;
  }

  function handleToggle(code: ServiceCode) {
    if (!canEdit) return;
    mutation.mutate({ code, body: { enabled: !isEnabled(code) } });
  }

  function handleSaveSpots(code: ServiceCode) {
    if (!canEdit) return;
    const raw = spotInputs[code] ?? '0';
    const spots = Number(raw);
    if (!Number.isFinite(spots) || spots < 0) {
      showToast({
        message: 'Las plazas deben ser un número mayor o igual a 0.',
        kind: 'error',
      });
      return;
    }
    mutation.mutate({ code, body: { spots: Math.floor(spots) } });
  }

  function spotsDirty(code: ServiceCode): boolean {
    const raw = spotInputs[code];
    if (raw === undefined) return false;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && Math.floor(n) !== serverSpots(code);
  }

  if (isLoading) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando servicios...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Servicios
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          Activá las prestaciones y asigná las plazas por tipo de vehículo.
        </p>
      </div>

      {/* Reserva anticipada (feature flag, sin plazas). */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={sectionTitle}>Reservas</h3>
        <div
          className="pk-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}
            >
              {SERVICE_LABELS.ADVANCE_RESERVATION}
            </span>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 13,
                color: 'var(--text-3)',
              }}
            >
              Permite a los clientes reservar un lugar con anticipación.
            </p>
          </div>
          <Switch
            checked={isEnabled('ADVANCE_RESERVATION')}
            onChange={() => handleToggle('ADVANCE_RESERVATION')}
            disabled={!canEdit || mutation.isPending}
            aria-label={SERVICE_LABELS.ADVANCE_RESERVATION}
          />
        </div>
      </section>

      {/* Vehículos aceptados, cada uno con sus plazas. */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={sectionTitle}>Vehículos aceptados</h3>
        <div className="pk-card" style={{ overflow: 'hidden' }}>
          {VEHICLE_CODES.map((code, i) => (
            <div
              key={code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 20px',
                borderBottom:
                  i < VEHICLE_CODES.length - 1
                    ? '1px solid var(--border-soft)'
                    : undefined,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-1)',
                }}
              >
                {SERVICE_LABELS[code]}
              </span>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--text-3)',
                }}
              >
                Plazas
                <input
                  type="number"
                  min={0}
                  className="pk-input"
                  style={{ width: 80 }}
                  value={spotInputs[code] ?? ''}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setSpotInputs((m) => ({ ...m, [code]: e.target.value }))
                  }
                />
              </label>

              {canEdit && spotsDirty(code) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSaveSpots(code)}
                  disabled={mutation.isPending}
                >
                  Guardar
                </Button>
              )}

              <Switch
                checked={isEnabled(code)}
                onChange={() => handleToggle(code)}
                disabled={!canEdit || mutation.isPending}
                aria-label={SERVICE_LABELS[code]}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
};
