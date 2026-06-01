import type { Bay, BayStatus } from '../../../../types/api';
import { formatElapsed, formatTime } from '../../../../shared/utils/fmt';
import {
  IconAuto,
  IconMoto,
  IconBici,
  IconClock,
} from '../../../../shared/components/icons';

const STATUS_COLORS: Record<BayStatus, string> = {
  occupied: 'var(--ok-text)',
  overdue: 'var(--err-text)',
  reserved: 'var(--brand)',
  vacant: 'var(--text-3)',
};

const STATUS_BG: Record<BayStatus, string> = {
  occupied: 'var(--ok-bg)',
  overdue: 'var(--err-bg)',
  reserved: 'var(--brand-soft)',
  vacant: 'var(--bg-a)',
};

const STATUS_LABELS: Record<BayStatus, string> = {
  occupied: 'Adentro',
  overdue: 'Excedido',
  reserved: 'Con reserva',
  vacant: 'Libre',
};

const TYPE_ICONS = { auto: IconAuto, moto: IconMoto, bici: IconBici };

interface VehicleCardProps {
  bay: Bay;
  onClick: (bay: Bay) => void;
}

export function VehicleCard({ bay, onClick }: VehicleCardProps) {
  const TypeIcon = TYPE_ICONS[bay.tipo];
  const borderColor = STATUS_COLORS[bay.status];
  const iconBg = STATUS_BG[bay.status];

  if (bay.status === 'vacant') return null;

  return (
    <div
      onClick={() => onClick(bay)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(bay);
      }}
      className="pk-card vehicle-card"
      style={{
        cursor: 'pointer',
        padding: 14,
        borderColor,
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        transition: 'box-shadow 160ms, transform 160ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-float)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = '';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--r-sm)',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: borderColor,
          }}
        >
          <TypeIcon size={16} />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 999,
            background: iconBg,
            color: borderColor,
            letterSpacing: '-0.01em',
          }}
        >
          {STATUS_LABELS[bay.status]}
        </span>
      </div>

      <p
        style={{
          margin: '0 0 2px',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'var(--mono)',
          letterSpacing: '0.03em',
          color: 'var(--text-1)',
        }}
      >
        {bay.patente}
      </p>
      {bay.modelo && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)' }}>
          {bay.modelo}
          {bay.color && bay.color !== '—' ? ` · ${bay.color}` : ''}
        </p>
      )}

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <IconClock size={12} style={{ color: 'var(--text-3)' }} />
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-3)',
            fontFamily: 'var(--mono)',
          }}
        >
          {bay.ingreso_at ? formatTime(bay.ingreso_at) : '—'}
          {bay.ingreso_at ? ` · ${formatElapsed(bay.ingreso_at)}` : ''}
        </span>
        {bay.status === 'overdue' && bay.excedido_min && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--err-text)',
              marginLeft: 4,
              fontFamily: 'var(--mono)',
            }}
          >
            +{bay.excedido_min} min
          </span>
        )}
      </div>
    </div>
  );
}
