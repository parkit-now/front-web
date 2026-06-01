import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import {
  IconCheck,
  IconClose,
  IconInbox,
} from '../../../../shared/components/icons';
import {
  useApplicationActions,
  useApplicationDetail,
  useApplicationsList,
} from '../../hooks/useApplications';
import { readDeclaredEntity } from '../../services/applications';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const labelStyle: React.CSSProperties = {
  margin: '0 0 2px',
  fontSize: 11,
  color: 'var(--text-3)',
  fontWeight: 500,
};
const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'var(--text-1)',
  fontWeight: 500,
};

export function SolicitudesPage() {
  const listQuery = useApplicationsList('pending');
  const items = listQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailQuery = useApplicationDetail(selectedId);
  const { approveMutation, rejectMutation } = useApplicationActions();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Keep a valid selection as the queue changes (initial load, approve/reject).
  useEffect(() => {
    if (items.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((it) => it.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const detail = detailQuery.data ?? null;
  const declared = readDeclaredEntity(detail);
  const processing = approveMutation.isPending || rejectMutation.isPending;

  function handleApprove() {
    if (!selectedId || processing) return;
    approveMutation.mutate(selectedId);
  }

  function handleConfirmReject() {
    if (!selectedId || rejectReason.trim().length === 0) return;
    rejectMutation.mutate(
      { id: selectedId, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason('');
        },
      },
    );
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
            {items.length}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {listQuery.isLoading ? (
            <p style={{ padding: 20, color: 'var(--text-2)', fontSize: 14 }}>
              Cargando solicitudes...
            </p>
          ) : listQuery.isError ? (
            <div style={{ padding: 20 }}>
              <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
                No pudimos cargar las solicitudes.
              </p>
              <Button
                variant="secondary"
                onClick={() => void listQuery.refetch()}
              >
                Reintentar
              </Button>
            </div>
          ) : items.length === 0 ? (
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
                    transition: 'background 120ms',
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
                    {item.name}
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
                    {item.applicantEmail}
                  </p>
                  <p
                    style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}
                  >
                    {formatDate(item.submittedAt)} · {item.docsCount} docs
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
        {selectedId && detailQuery.isLoading ? (
          <p style={{ padding: 28, color: 'var(--text-2)', fontSize: 14 }}>
            Cargando detalle...
          </p>
        ) : detail ? (
          <>
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
                  {detail.name.charAt(0)}
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
                    {detail.name}
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: 12,
                      color: 'var(--text-3)',
                    }}
                  >
                    Enviada: {formatDate(detail.submittedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
              }}
            >
              {/* Sucursal + contacto */}
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
                  Datos de la sucursal
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px 24px',
                  }}
                >
                  {[
                    ['Solicitante', detail.applicantEmail],
                    ['Razón social', detail.legalName],
                    ['Email de contacto', detail.email],
                    ['CUIT', detail.cuit],
                    ['Domicilio', detail.address ?? '—'],
                    ['Teléfono', detail.phone ?? '—'],
                    [
                      'Plazas declaradas',
                      `${declared.carSpots ?? 0} autos · ${declared.motorcycleSpots ?? 0} motos · ${declared.bicycleSpots ?? 0} bicis`,
                    ],
                    ['Documentos adjuntos', `${detail.docsCount} archivos`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p style={labelStyle}>{label}</p>
                      <p style={valueStyle}>{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pk-divider" />

              {/* Documentos */}
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
                  Documentación adjunta
                </p>
                {detail.documents.length === 0 ? (
                  <p
                    style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}
                  >
                    El solicitante no adjuntó documentos.
                  </p>
                ) : (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    {detail.documents.map((doc) => (
                      <div
                        key={doc.id}
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
                          {doc.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

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
                disabled={processing}
                onClick={() => setRejectOpen(true)}
              >
                Rechazar
              </Button>
              <Button
                variant="primary"
                icon={<IconCheck size={15} />}
                loading={approveMutation.isPending}
                disabled={processing}
                onClick={handleApprove}
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

      {/* Reject reason modal */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Rechazar solicitud"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={rejectMutation.isPending}
              disabled={rejectReason.trim().length === 0}
              onClick={handleConfirmReject}
            >
              Rechazar
            </Button>
          </>
        }
      >
        <label
          htmlFor="reject-reason"
          style={{
            display: 'block',
            marginBottom: 8,
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          Indicá el motivo del rechazo. El solicitante podrá corregir y volver a
          enviar.
        </label>
        <textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="Ej.: el CUIT no coincide con la razón social declarada."
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border-soft)',
            fontSize: 14,
            fontFamily: 'inherit',
            color: 'var(--text-1)',
            background: 'var(--bg-a)',
          }}
        />
      </Modal>
    </div>
  );
}
