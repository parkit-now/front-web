import { useState } from 'react';
import { ConfigPerfil } from './ConfigPerfil';
import { ConfigPagos } from './ConfigPagos';
import { ConfigBilling } from './ConfigBilling';
import { ConfigHorarios } from './ConfigHorarios';
import { ConfigServicios } from './ConfigServicios';

type Tab = 'perfil' | 'horarios' | 'servicios' | 'pagos' | 'facturacion';

const TABS: { id: Tab; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'horarios', label: 'Horarios' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'pagos', label: 'Medios de pago' },
  { id: 'facturacion', label: 'Facturación' },
];

export function ConfigPage() {
  const [tab, setTab] = useState<Tab>('perfil');

  return (
    <div style={{ padding: 32, display: 'flex', gap: 0 }}>
      {/* Sidebar tabs */}
      <nav
        style={{
          width: 200,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          paddingRight: 20,
          borderRight: '1px solid var(--border-soft)',
          marginRight: 32,
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-3)',
          }}
        >
          Configuración
        </p>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              borderRadius: 'var(--r-md)',
              border: 'none',
              fontSize: 14,
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 150ms',
              background: tab === t.id ? 'var(--brand-soft)' : 'transparent',
              color: tab === t.id ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {tab === 'perfil' && <ConfigPerfil />}
        {tab === 'horarios' && <ConfigHorarios />}
        {tab === 'servicios' && <ConfigServicios />}
        {tab === 'pagos' && <ConfigPagos />}
        {tab === 'facturacion' && <ConfigBilling />}
      </div>
    </div>
  );
}
