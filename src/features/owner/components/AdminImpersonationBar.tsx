import { useNavigate } from 'react-router-dom';
import { IconShield, IconChevronLeft } from '../../../shared/components/icons';
import { useSucursal } from '../context/SucursalContext';

export const ADMIN_BAR_HEIGHT = 44;

/**
 * Persistent banner shown while an admin is operating a parking lot through the
 * owner panel. Its job is purely to remove ambiguity: a distinct colour the
 * owner panel never shows, the lot being managed, and an always-visible exit
 * back to the admin panel.
 */
export function AdminImpersonationBar() {
  const navigate = useNavigate();
  const { sucursal } = useSucursal();

  return (
    <div
      style={{
        height: ADMIN_BAR_HEIGHT,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        background: 'var(--warn-bg)',
        borderBottom: '1px solid var(--warn-text)',
        color: 'var(--warn-text)',
      }}
    >
      <IconShield size={16} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>Modo administrador</span>
      {sucursal && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            opacity: 0.85,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          · {sucursal.nombre}
        </span>
      )}

      <button
        type="button"
        onClick={() => void navigate('/ops/inventory')}
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--warn-text)',
          background: 'transparent',
          color: 'var(--warn-text)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 120ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <IconChevronLeft size={15} />
        Salir al panel de administración
      </button>
    </div>
  );
}
