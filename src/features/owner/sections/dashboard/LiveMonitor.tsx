import { useMemo, useState } from 'react';
import type { Bay, BayType } from '../../../../types/api';
import { normalizePatente } from '../../../../shared/utils/fmt';
import { VehicleCard } from './VehicleCard';
import { ZoneTabs } from './ZoneTabs';
import { BayDrawer } from './BayDrawer';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { IconSearch, IconCar } from '../../../../shared/components/icons';

interface LiveMonitorProps {
  bays: Bay[];
}

type StatusFilter = 'all' | 'overdue' | 'reserved';
type TypeFilter = 'all' | BayType;

export function LiveMonitor({ bays }: LiveMonitorProps) {
  const [activeZone, setActiveZone] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);

  const occupiedBays = bays.filter((b) => b.status !== 'vacant');
  const overdueBays = bays.filter((b) => b.status === 'overdue');

  const filteredBays = useMemo(() => {
    let result = bays.filter((b) => b.status !== 'vacant');

    if (activeZone !== 'all') {
      result = result.filter((b) => b.zona === activeZone);
    }
    if (statusFilter === 'overdue') {
      result = result.filter((b) => b.status === 'overdue');
    } else if (statusFilter === 'reserved') {
      result = result.filter((b) => b.status === 'reserved');
    }
    if (typeFilter !== 'all') {
      result = result.filter((b) => b.tipo === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = normalizePatente(searchQuery);
      result = result.filter(
        (b) => b.patente && normalizePatente(b.patente).includes(q),
      );
    }

    // Sort: overdue first, then by ingreso_at ascending
    result.sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (a.status !== 'overdue' && b.status === 'overdue') return 1;
      if (!a.ingreso_at) return 1;
      if (!b.ingreso_at) return -1;
      return a.ingreso_at.localeCompare(b.ingreso_at);
    });

    return result;
  }, [bays, activeZone, statusFilter, typeFilter, searchQuery]);

  const overdueBaysZone = bays.filter(
    (b) =>
      b.status === 'overdue' && (activeZone === 'all' || b.zona === activeZone),
  );
  const reservedBaysZone = bays.filter(
    (b) =>
      b.status === 'reserved' &&
      (activeZone === 'all' || b.zona === activeZone),
  );
  const freeBays = bays.filter((b) => b.status === 'vacant').length;

  function handleZoneChange(zone: string) {
    setActiveZone(zone);
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  }

  return (
    <>
      <div className="pk-card" style={{ overflow: 'hidden' }}>
        {/* Card header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-1)',
              }}
            >
              Monitoreo en vivo
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--ok-text)',
                  display: 'inline-block',
                  animation: 'pk-pulse-err 2.4s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--ok-text)',
                  fontWeight: 500,
                }}
              >
                En vivo
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              fontSize: 13,
              color: 'var(--text-2)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--text-1)' }}>
                {occupiedBays.length}
              </strong>{' '}
              adentro
            </span>
            <span>
              <strong style={{ color: 'var(--text-1)' }}>{freeBays}</strong>{' '}
              libres
            </span>
            {overdueBays.length > 0 && (
              <span>
                <strong style={{ color: 'var(--err-text)' }}>
                  {overdueBays.length}
                </strong>{' '}
                excedidos
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          <ZoneTabs
            bays={bays}
            activeZone={activeZone}
            onZoneChange={handleZoneChange}
          />

          {/* Search + status filters */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <IconSearch
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-3)',
                }}
              />
              <input
                className="pk-input"
                style={{ paddingLeft: 32, height: 36 }}
                placeholder="Buscar patente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar por patente"
              />
            </div>
            {(['all', 'overdue', 'reserved'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className="pk-badge"
                style={{
                  cursor: 'pointer',
                  height: 32,
                  padding: '0 12px',
                  background:
                    statusFilter === f ? 'var(--brand-soft)' : 'var(--bg-a)',
                  color: statusFilter === f ? 'var(--brand)' : 'var(--text-2)',
                  border: `1px solid ${statusFilter === f ? 'var(--brand-100)' : 'var(--border-soft)'}`,
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 'var(--r-sm)',
                }}
              >
                {f === 'all'
                  ? 'Todos'
                  : f === 'overdue'
                    ? `Excedidos (${overdueBaysZone.length})`
                    : `Con reserva (${reservedBaysZone.length})`}
              </button>
            ))}
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {(['all', 'auto', 'moto', 'bici'] as TypeFilter[]).map((f) => {
              const count =
                f === 'all'
                  ? filteredBays.length
                  : filteredBays.filter((b) => b.tipo === f).length;
              if (f !== 'all' && count === 0 && typeFilter !== f) return null;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTypeFilter(f)}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: 'var(--r-sm)',
                    border: `1px solid ${typeFilter === f ? 'var(--brand-100)' : 'var(--border-soft)'}`,
                    background:
                      typeFilter === f ? 'var(--brand-soft)' : 'transparent',
                    color: typeFilter === f ? 'var(--brand)' : 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  {f === 'all'
                    ? 'Todos'
                    : f.charAt(0).toUpperCase() + f.slice(1)}{' '}
                  ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: '0 20px 20px' }}>
          {filteredBays.length === 0 ? (
            <EmptyState
              icon={<IconCar size={32} />}
              title={
                searchQuery
                  ? `No encontramos vehículos con patente "${searchQuery}"`
                  : 'No hay vehículos en esta zona'
              }
              description={
                searchQuery ? 'Revisá la patente o borrá el filtro' : undefined
              }
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              {filteredBays.map((bay) => (
                <VehicleCard key={bay.id} bay={bay} onClick={setSelectedBay} />
              ))}
            </div>
          )}
        </div>
      </div>

      <BayDrawer bay={selectedBay} onClose={() => setSelectedBay(null)} />
    </>
  );
}
