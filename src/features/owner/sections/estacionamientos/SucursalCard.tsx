import { useState } from 'react';
import type { Sucursal } from '../../../../types/api';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Switch } from '../../../../shared/components/ui/Switch';
import { ProgressBar } from '../../../../shared/components/ProgressBar';
import { useToast } from '../../../../lib/notifications/ToastProvider';

interface SucursalCardProps {
  sucursal: Sucursal;
}

export function SucursalCard({ sucursal }: SucursalCardProps) {
  const { showToast } = useToast();
  const [estado, setEstado] = useState<'active' | 'maintenance'>(
    sucursal.estado,
  );

  const isActive = estado === 'active';

  function handleToggle(checked: boolean) {
    const next = checked ? 'active' : 'maintenance';
    setEstado(next);
    showToast({
      message: checked
        ? `${sucursal.nombre} marcado como activo.`
        : `${sucursal.nombre} puesto en mantenimiento.`,
      kind: 'info',
    });
  }

  const occupancyColor =
    sucursal.ocupacion_pct >= 90
      ? 'var(--err-text)'
      : sucursal.ocupacion_pct >= 70
        ? 'var(--warn-text)'
        : 'var(--brand)';

  return (
    <div
      className="pk-card pk-card-pad"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sucursal.nombre}
          </h3>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 13,
              color: 'var(--text-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sucursal.direccion}
          </p>
        </div>
        <Badge variant={isActive ? 'ok' : 'warn'}>
          {isActive ? 'Activo' : 'Mantenimiento'}
        </Badge>
      </div>

      {/* Plaza stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {[
          { label: 'Auto', value: sucursal.plazas_auto },
          { label: 'Moto', value: sucursal.plazas_moto },
          { label: 'Bici', value: sucursal.plazas_bici },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'var(--bg-b)',
              borderRadius: 'var(--r-md)',
              padding: '8px 10px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-1)',
                fontFamily: 'var(--mono)',
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Occupancy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Ocupación
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: occupancyColor,
              fontFamily: 'var(--mono)',
            }}
          >
            {sucursal.ocupacion_pct}%
          </span>
        </div>
        <ProgressBar
          value={sucursal.ocupacion_pct}
          max={100}
          color={occupancyColor}
        />
      </div>

      {/* Footer: switch */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 4,
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Estado operativo
        </span>
        <Switch
          checked={isActive}
          onChange={handleToggle}
          aria-label={`Toggle estado de ${sucursal.nombre}`}
        />
      </div>
    </div>
  );
}
