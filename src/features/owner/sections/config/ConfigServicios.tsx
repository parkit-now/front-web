import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ReservationSetupCard } from './ReservationSetupCard';
import { useSucursal } from '../../context/SucursalContext';
import { listServices } from '../../services/services';

export function ConfigServicios() {
  const { sucursalId } = useSucursal();

  const { data, isLoading } = useQuery({
    queryKey: ['services', sucursalId],
    queryFn: () => listServices(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const services = useMemo(() => data ?? [], [data]);
  const reservation = services.find((s) => s.code === 'ADVANCE_RESERVATION');

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
          Activá las prestaciones del estacionamiento.
        </p>
      </div>

      {reservation && <ReservationSetupCard service={reservation} />}

      {/* Qué vehículos acepta la caja se administra en Tipos de vehículo (el
          mismo flag `accepted`); acá solo queda el camino hacia esa pantalla. */}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
        ¿Qué vehículos acepta la caja?{' '}
        <Link to="../../tipos-de-vehiculo">
          Administrá los tipos de vehículo
        </Link>
      </p>
    </div>
  );
}
