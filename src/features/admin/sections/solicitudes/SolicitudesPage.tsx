import { useState } from 'react';
import { SOLICITUDES } from '../../../../mock/admin';
import type { Solicitud } from '../../../../types/api';
import { Button } from '../../../../shared/components/ui/Button';
import {
  IconCheck,
  IconClose,
  IconInbox,
} from '../../../../shared/components/icons';
import { useToast } from '../../../../lib/notifications/ToastProvider';

const VALIDATION_ITEMS = [
  'CUIT verificado en AFIP',
  'Documentación societaria completa',
  'Email corporativo confirmado',
  'Sin antecedentes en base negativa',
];

function formatCount(n: number): number {
  return n;
}

export function SolicitudesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Solicitud[]>(
    SOLICITUDES.filter((s) => s.estado === 'pending'),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [fadingId, setFadingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const selected = items.find((s) => s.id === selectedId) ?? null;

  async function handleAction(action: 'approve' | 'reject') {
    if (!selectedId || processing) return;
    setProcessing(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Fade out the item
    setFadingId(selectedId);

    // After fade transition, remove and auto-select next
    setTimeout(() => {
      setItems((prev) => {
        const idx = prev.findIndex((s) => s.id === selectedId);
        const next = prev[idx + 1] ?? prev[idx - 1] ?? null;
        setSelectedId(next ? next.id : null);
        return prev.filter((s) => s.id !== selectedId);
      });
      setFadingId(null);
      setProcessing(false);
    }, 300);

    showToast({
      message:
        action === 'approve'
          ? 'Alta aprobada correctamente.'
          : 'Solicitud rechazada.',
      kind: action === 'approve' ? 'success' : 'info',
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 64px - 48px)',
        gap: 0,
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-soft)',
        background: 'var(--card)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Left pane: list */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-soft)',
        }}
      >
        {/* List header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-1)',
              flex: 1,
            }}
          >
            Solicitudes
          </h2>
          <span
            style={{
              minWidth: 24,
              height: 24,
              padding: '0 7px',
              background: 'var(--brand)',
              color: '#fff',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {formatCount(items.length)}
          </span>
        </div>

        {/* Solicitud list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 32 }}>✓</span>
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-2)',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                ¡Al día! No quedan solicitudes pendientes de revisión.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isActive = item.id === selectedId;
              const isFading = item.id === fadingId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'block',
                    padding: '14px 20px',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-soft)',
                    borderLeft: isActive
                      ? '4px solid var(--brand)'
                      : '4px solid transparent',
                    paddingLeft: isActive ? 16 : 20,
                    background: isActive ? 'var(--brand-soft)' : 'transparent',
                    transition:
                      'opacity 300ms ease, transform 300ms ease, background 120ms',
                    opacity: isFading ? 0 : 1,
                    transform: isFading ? 'translateX(-16px)' : 'translateX(0)',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 2px',
                      fontSize: 13,
                      fontWeight: 600,
                      color: isActive ? 'var(--brand)' : 'var(--text-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.empresa_nombre}
                  </p>
                  <p
                    style={{
                      margin: '0 0 4px',
                      fontSize: 12,
                      color: 'var(--text-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.dueno_nombre}
                  </p>
                  <p
                    style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}
                  >
                    {item.recibido_label} · {item.docs_count} docs
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane: detail */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowY: 'auto',
        }}
      >
        {selected ? (
          <>
            {/* Detail header */}
            <div
              style={{
                padding: '20px 28px',
                borderBottom: '1px solid var(--border-soft)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--r-md)',
                    background: 'var(--brand-soft)',
                    color: 'var(--brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {selected.empresa_nombre[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 17,
                      fontWeight: 700,
                      color: 'var(--text-1)',
                    }}
                  >
                    {selected.empresa_nombre}
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: 12,
                      color: 'var(--text-3)',
                    }}
                  >
                    {selected.id} · Recibido: {selected.recibido_label}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail body */}
            <div
              style={{
                flex: 1,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Company info */}
              <section>
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
                  Información de la empresa
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px 24px',
                  }}
                >
                  {[
                    ['Dueño / Representante', selected.dueno_nombre],
                    ['Email de contacto', selected.email],
                    ['CUIT', selected.cuit],
                    [
                      'Sucursales declaradas',
                      String(selected.sucursales_declaradas),
                    ],
                    ['Documentos adjuntos', `${selected.docs_count} archivos`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p
                        style={{
                          margin: '0 0 2px',
                          fontSize: 11,
                          color: 'var(--text-3)',
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: 'var(--text-1)',
                          fontWeight: 500,
                        }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pk-divider" />

              {/* Validation checklist */}
              <section>
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
                  Validación automática
                </p>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {VALIDATION_ITEMS.map((item) => (
                    <div
                      key={item}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'var(--ok-bg)',
                          color: 'var(--ok-text)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconCheck size={12} />
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Actions footer */}
            <div
              style={{
                padding: '16px 28px',
                borderTop: '1px solid var(--border-soft)',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="danger"
                icon={<IconClose size={15} />}
                loading={processing}
                disabled={processing}
                onClick={() => void handleAction('reject')}
              >
                Rechazar
              </Button>
              <Button
                variant="primary"
                icon={<IconCheck size={15} />}
                loading={processing}
                disabled={processing}
                onClick={() => void handleAction('approve')}
              >
                Aprobar alta
              </Button>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 40,
            }}
          >
            <IconInbox size={40} style={{ color: 'var(--text-3)' }} />
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14 }}>
              Seleccioná una solicitud para revisarla
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
