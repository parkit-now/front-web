import { Drawer } from '../../../../shared/components/ui/Drawer';
import { Button } from '../../../../shared/components/ui/Button';
import { Avatar } from '../../../../shared/components/Avatar';
import {
  fmtMoney,
  formatElapsed,
  formatTime,
} from '../../../../shared/utils/fmt';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { useSucursal } from '../../context/SucursalContext';
import type { Bay, BayStatus } from '../../../../types/api';

const STATUS_LABELS: Record<BayStatus, string> = {
  occupied: 'Adentro',
  overdue: 'Excedido',
  reserved: 'Con reserva',
  vacant: 'Libre',
};

const STATUS_COLORS: Record<
  BayStatus,
  { bg: string; text: string; border: string }
> = {
  occupied: {
    bg: 'var(--ok-bg)',
    text: 'var(--ok-text)',
    border: 'var(--ok-border)',
  },
  overdue: {
    bg: 'var(--err-bg)',
    text: 'var(--err-text)',
    border: 'var(--err-border)',
  },
  reserved: {
    bg: 'var(--brand-soft)',
    text: 'var(--brand)',
    border: 'var(--brand-100)',
  },
  vacant: { bg: 'var(--bg-a)', text: 'var(--text-2)', border: 'var(--border)' },
};

interface BayDrawerProps {
  bay: Bay | null;
  onClose: () => void;
}

export function BayDrawer({ bay, onClose }: BayDrawerProps) {
  const { showToast } = useToast();
  const { sucursal } = useSucursal();

  function handlePago() {
    showToast({
      message: `Pago registrado para ${bay?.patente}`,
      kind: 'success',
    });
    onClose();
  }

  function handleSalida() {
    showToast({
      message: `Salida forzada de ${bay?.patente}`,
      kind: 'success',
    });
    onClose();
  }

  const colors = bay ? STATUS_COLORS[bay.status] : STATUS_COLORS.vacant;

  return (
    <Drawer
      open={!!bay}
      onClose={onClose}
      title="Detalle del vehículo"
      width={460}
      footer={
        bay ? (
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <Button
              variant="danger"
              size="sm"
              onClick={handleSalida}
              style={{ flex: 1 }}
            >
              Forzar salida
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePago}
              style={{ flex: 1 }}
            >
              Registrar pago
            </Button>
          </div>
        ) : undefined
      }
    >
      {bay && (
        <div>
          {/* Patente header */}
          <div style={{ padding: '20px 20px 16px' }}>
            <p
              style={{
                margin: '0 0 4px',
                fontSize: 24,
                fontWeight: 800,
                fontFamily: 'var(--mono)',
                letterSpacing: '0.04em',
                color: 'var(--text-1)',
              }}
            >
              {bay.patente}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Zona {bay.zona}
              </span>
              {sucursal && (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  · {sucursal.nombre}
                </span>
              )}
            </div>
          </div>

          {/* Status banner */}
          <div
            style={{
              margin: '0 20px 20px',
              padding: '12px 16px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
              {STATUS_LABELS[bay.status]}
              {bay.status === 'overdue' && bay.excedido_min
                ? ` · +${bay.excedido_min} min`
                : ''}
            </span>
            <Button variant="primary" size="sm" onClick={handlePago}>
              Registrar pago
            </Button>
          </div>

          {/* Details grid */}
          <div
            style={{
              padding: '0 20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: 'Tipo',
                value: bay.tipo.charAt(0).toUpperCase() + bay.tipo.slice(1),
              },
              {
                label: 'Vehículo',
                value: `${bay.modelo ?? '—'}${bay.color && bay.color !== '—' ? ` · ${bay.color}` : ''}`,
              },
              { label: 'Zona', value: `Zona ${bay.zona}` },
              {
                label: 'Ingreso',
                value: bay.ingreso_at ? formatTime(bay.ingreso_at) : '—',
              },
              {
                label: 'Transcurrido',
                value: bay.ingreso_at ? formatElapsed(bay.ingreso_at) : '—',
              },
              { label: 'Tarifa/hora', value: fmtMoney(bay.tarifa_por_hora) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="pk-label" style={{ marginBottom: 4 }}>
                  {label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: 'var(--text-1)',
                    fontWeight: 500,
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Client info */}
          {bay.cliente_nombre && (
            <>
              <div className="pk-divider" style={{ margin: '0 20px 16px' }} />
              <div
                style={{
                  padding: '0 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <Avatar name={bay.cliente_nombre} size={40} soft />
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                    }}
                  >
                    {bay.cliente_nombre}
                  </p>
                  {bay.cliente_telefono && (
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 12,
                        color: 'var(--text-2)',
                      }}
                    >
                      {bay.cliente_telefono}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Reserva */}
          {bay.reserva_id && (
            <div style={{ padding: '0 20px', marginBottom: 20 }}>
              <span className="pk-badge pk-badge-brand">{bay.reserva_id}</span>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
