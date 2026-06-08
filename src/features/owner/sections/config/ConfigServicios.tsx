import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '../../../../shared/components/ui/Switch';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  listServices,
  toggleService,
  type ServiceCode,
} from '../../services/services';

const SERVICE_LABELS: Record<ServiceCode, string> = {
  ADVANCE_RESERVATION: 'Reserva anticipada',
  VEHICLE_ELECTRIC: 'Vehículos eléctricos',
  VEHICLE_BICYCLE: 'Bicicletas',
  VEHICLE_MOTORCYCLE: 'Motos',
  VEHICLE_PICKUP: 'Camionetas',
  VEHICLE_TRUCK: 'Camiones',
};

const VEHICLE_CODES: ServiceCode[] = [
  'VEHICLE_ELECTRIC',
  'VEHICLE_BICYCLE',
  'VEHICLE_MOTORCYCLE',
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

  const mutation = useMutation({
    mutationFn: ({ code, enabled }: { code: ServiceCode; enabled: boolean }) =>
      toggleService(sucursalId, code, enabled),
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

  const enabledByCode = new Map(services.map((s) => [s.code, s.enabled]));

  function isEnabled(code: ServiceCode): boolean {
    return enabledByCode.get(code) ?? false;
  }

  function handleToggle(code: ServiceCode) {
    if (!canEdit) return;
    mutation.mutate({ code, enabled: !isEnabled(code) });
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
          Activá las prestaciones que ofrece tu estacionamiento.
        </p>
      </div>

      {/* Reserva anticipada (feature flag). */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-3)',
          }}
        >
          Reservas
        </h3>
        <ServiceRow
          label={SERVICE_LABELS.ADVANCE_RESERVATION}
          hint="Permite a los clientes reservar un lugar con anticipación."
          checked={isEnabled('ADVANCE_RESERVATION')}
          disabled={!canEdit || mutation.isPending}
          onToggle={() => handleToggle('ADVANCE_RESERVATION')}
        />
      </section>

      {/* Tipos de vehículo aceptados. */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-3)',
          }}
        >
          Vehículos aceptados
        </h3>
        <div className="pk-card" style={{ overflow: 'hidden' }}>
          {VEHICLE_CODES.map((code, i) => (
            <ServiceRow
              key={code}
              label={SERVICE_LABELS[code]}
              checked={isEnabled(code)}
              disabled={!canEdit || mutation.isPending}
              onToggle={() => handleToggle(code)}
              withBorder={i < VEHICLE_CODES.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface ServiceRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  withBorder?: boolean;
}

function ServiceRow({
  label,
  hint,
  checked,
  disabled,
  onToggle,
  withBorder,
}: ServiceRowProps) {
  return (
    <div
      className={hint ? 'pk-card' : ''}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: hint ? 16 : '14px 20px',
        borderBottom: withBorder ? '1px solid var(--border-soft)' : undefined,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
          {label}
        </span>
        {hint && (
          <p
            style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-3)' }}
          >
            {hint}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}
