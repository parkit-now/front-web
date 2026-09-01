import { useMemo, useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Switch } from '../../../../shared/components/ui/Switch';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { ApiError } from '../../../../lib/api/client';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  listServices,
  updateService,
  type ServiceCode,
} from '../../services/services';
import {
  listVehicleTypes,
  updateVehicleType,
  type VehicleType,
} from '../../services/vehicle-types';

const SERVICE_LABELS: Record<ServiceCode, string> = {
  ADVANCE_RESERVATION: 'Reserva anticipada',
};

export function ConfigServicios() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canEdit = sucursal?.role === 'owner';

  const servicesKey = ['services', sucursalId];
  const { data, isLoading } = useQuery({
    queryKey: servicesKey,
    queryFn: () => listServices(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const services = useMemo(() => data ?? [], [data]);
  const byCode = new Map(services.map((s) => [s.code, s]));

  // "Qué vehículos acepta la playa" ya no es un enum de cinco códigos fijos:
  // son los tipos por estacionamiento, que el dueño administra en su propia
  // sección. Acá sólo se prende y apaga el flag `accepted`.
  const typesKey = ['vehicle-types', sucursalId];
  const typesQuery = useQuery({
    queryKey: typesKey,
    queryFn: () => listVehicleTypes(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);

  const [busyTypeId, setBusyTypeId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (code: ServiceCode) =>
      updateService(sucursalId, code, { enabled: !isEnabled(code) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: servicesKey });
    },
    onError: (error) =>
      showToast({ message: translateApiError(error), kind: 'error' }),
  });

  /**
   * El toggle de un tipo lleva `expectedVersion`, así que puede dar 409 — algo
   * que esta pantalla nunca tuvo cuando los "vehículos aceptados" eran códigos
   * fijos sin control de versión. Sin esta rama, un toggle stale falla con un
   * mensaje genérico y sin refrescar la lista.
   */
  const acceptedMutation = useMutation({
    mutationFn: (type: VehicleType) =>
      updateVehicleType(sucursalId, type.id, type.version, {
        accepted: !type.accepted,
      }),
    onSettled: () => setBusyTypeId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: typesKey });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: typesKey });
        showToast({
          message:
            'El tipo fue modificado por otra persona. Actualizamos la lista, probá de nuevo.',
          kind: 'error',
        });
        return;
      }
      showToast({ message: translateApiError(error), kind: 'error' });
    },
  });

  function isEnabled(code: ServiceCode): boolean {
    return byCode.get(code)?.enabled ?? false;
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
          Activá las prestaciones y elegí qué vehículos acepta la playa.
        </p>
      </div>

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
            onChange={() => mutation.mutate('ADVANCE_RESERVATION')}
            disabled={!canEdit || mutation.isPending}
            aria-label={SERVICE_LABELS.ADVANCE_RESERVATION}
          />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={sectionTitle}>Vehículos aceptados</h3>

        {typesQuery.isLoading && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Cargando tipos de vehículo...
          </p>
        )}

        {!typesQuery.isLoading && typesQuery.isError && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--err-text)' }}>
            No pudimos cargar los tipos de vehículo.
          </p>
        )}

        {!typesQuery.isLoading && !typesQuery.isError && types.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Todavía no configuraste tipos de vehículo.
          </p>
        )}

        {types.length > 0 && (
          <div className="pk-card" style={{ overflow: 'hidden' }}>
            {types.map((type, i) => (
              <div
                key={type.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  borderBottom:
                    i < types.length - 1
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
                  {type.name}
                </span>
                <Switch
                  checked={type.accepted}
                  onChange={() => {
                    setBusyTypeId(type.id);
                    acceptedMutation.mutate(type);
                  }}
                  disabled={
                    !canEdit ||
                    (acceptedMutation.isPending && busyTypeId === type.id)
                  }
                  aria-label={type.name}
                />
              </div>
            ))}
          </div>
        )}

        {/* Esta vista sólo prende y apaga. Sin este link no hay camino desde
            "quiero una categoría Utilitario" hasta el ABM que la crea. */}
        <p style={{ margin: 0, fontSize: 12 }}>
          <Link to="../tipos-de-vehiculo">Administrar tipos de vehículo</Link>
        </p>
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
