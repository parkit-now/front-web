import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSucursal } from '../context/SucursalContext';
import {
  IconBuilding,
  IconChevronDown,
  IconCheck,
} from '../../../shared/components/icons';

export function SucursalSwitcher() {
  const { sucursal, sucursales, sucursalId, setSucursalId } = useSucursal();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  function handleSelect(id: string) {
    if (id !== sucursalId) {
      setSucursalId(id);
      void queryClient.invalidateQueries();
    }
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-1)',
          maxWidth: 220,
          transition: 'all 160ms',
        }}
      >
        <IconBuilding
          size={16}
          style={{ color: 'var(--text-3)', flexShrink: 0 }}
        />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {sucursal?.nombre ?? 'Sucursal'}
        </span>
        <IconChevronDown
          size={14}
          style={{
            color: 'var(--text-3)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 160ms',
          }}
        />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              background: 'var(--card)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-float)',
              minWidth: 240,
              zIndex: 20,
              padding: 4,
            }}
            className="pk-fade-up"
          >
            {sucursales.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  background:
                    s.id === sucursalId ? 'var(--brand-soft)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  color: s.id === sucursalId ? 'var(--brand)' : 'var(--text-1)',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => {
                  if (s.id !== sucursalId)
                    e.currentTarget.style.background = 'var(--bg-a)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    s.id === sucursalId ? 'var(--brand-soft)' : 'transparent';
                }}
              >
                <IconBuilding size={14} />
                <span style={{ flex: 1 }}>{s.nombre}</span>
                {s.estado === 'maintenance' && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--warn-text)',
                      background: 'var(--warn-bg)',
                      padding: '1px 6px',
                      borderRadius: 999,
                    }}
                  >
                    Mant.
                  </span>
                )}
                {s.id === sucursalId && <IconCheck size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
