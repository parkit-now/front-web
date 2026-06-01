import type { Bay } from '../../../../types/api';
import { ZONAS_CONFIG } from '../../../../mock/bays';

interface ZoneTabsProps {
  bays: Bay[];
  activeZone: string;
  onZoneChange: (zone: string) => void;
}

export function ZoneTabs({ bays, activeZone, onZoneChange }: ZoneTabsProps) {
  const occupied = (zoneBays: Bay[]) =>
    zoneBays.filter((b) => b.status !== 'vacant').length;
  const total = (zoneBays: Bay[]) => zoneBays.length;

  const allOccupied = occupied(bays);
  const allTotal = total(bays);

  const zones = [
    { id: 'all', label: 'Todos', count: `${allOccupied}/${allTotal}`, bays },
    ...ZONAS_CONFIG.map((z) => {
      const zoneBays = bays.filter((b) => b.zona === z.id);
      return {
        id: z.id,
        label: z.nombre,
        count: `${occupied(zoneBays)}/${total(zoneBays)}`,
        bays: zoneBays,
      };
    }),
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border-soft)',
        marginBottom: 16,
      }}
    >
      {zones.map((z) => {
        const isActive = activeZone === z.id;
        return (
          <button
            key={z.id}
            type="button"
            onClick={() => onZoneChange(z.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--brand)' : 'var(--text-2)',
              borderBottom: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'all 160ms',
              whiteSpace: 'nowrap',
            }}
          >
            {z.label}
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--mono)',
                color: isActive ? 'var(--brand)' : 'var(--text-3)',
              }}
            >
              {z.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
