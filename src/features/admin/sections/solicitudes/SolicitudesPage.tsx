import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import {
  IconCheck,
  IconClose,
  IconDownload,
  IconEye,
  IconInbox,
} from '../../../../shared/components/icons';
import { AddressMap } from '../../../../shared/components/AddressPicker/AddressMap';
import {
  addressFromLocation,
  describeGeocodingSource,
  missingAddressFields,
  REQUIRED_ADDRESS_FIELDS,
  type AddressFormValue,
  type AddressTextField,
} from '../../../../shared/components/AddressPicker/addressUtils';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import {
  useApplicationActions,
  useApplicationDetail,
  useApplicationsList,
} from '../../hooks/useApplications';
import {
  getDocumentSignedUrl,
  type ApplicationDocument,
} from '../../services/applications';
import { DocumentPreviewModal } from './DocumentPreviewModal';

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

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
};

/** Etiquetas del desglose, en el orden en que se lee una dirección argentina. */
const ADDRESS_ROWS: { field: AddressTextField; label: string }[] = [
  { field: 'streetName', label: 'Calle' },
  { field: 'streetNumber', label: 'Altura' },
  { field: 'cityName', label: 'Localidad' },
  { field: 'stateName', label: 'Provincia' },
  { field: 'floor', label: 'Piso / Depto' },
  { field: 'postalCode', label: 'Código postal' },
];

/**
 * Domicilio declarado, DESGLOSADO, para quien aprueba el alta.
 *
 * El panel mostraba una sola línea (`detail.address`) mientras el backend ya
 * mandaba `location` con los campos separados. Eso convertía la revisión en un
 * acto de fe: la jurisdicción fiscal del dueño en Mercado Pago la determinan
 * `state_name`/`city_name` y las coordenadas, y ninguno de los dos se puede
 * verificar leyendo "Av. Cabildo 2000, CABA".
 *
 * Tres decisiones de qué mostrar (y qué NO):
 *
 *  1. Los CUATRO campos que Mercado Pago necesita se muestran SIEMPRE, con "—"
 *     en rojo cuando faltan. Un campo ausente es exactamente el dato que el
 *     revisor tiene que ver antes de aprobar; ocultarlo por "estar vacío"
 *     esconde el único problema que esta sección existe para mostrar. El piso
 *     y el CP, que MP no usa, aparecen sólo si están.
 *  2. El ORIGEN va como badge. "Normalizada con Georef" y "Cargada a mano" no
 *     merecen la misma confianza: la segunda es texto libre que nadie validó.
 *  3. El MAPA va, pero sólo si hay coordenadas. Un par "-34.56, -58.45" es
 *     ilegible para un humano — y es el dato que decide dónde cae el `Store`.
 *     Es read-only (`disabled`): el revisor verifica, no corrige.
 */
function DomicilioSection({ address }: { address: AddressFormValue }) {
  const missing = new Set<AddressTextField>(missingAddressFields(address));
  const sourceLabel = describeGeocodingSource(address.geocodingSource);
  const hasPin = address.latitude !== null && address.longitude !== null;
  const primary = address.formatted.trim();

  return (
    <section data-testid="solicitud-domicilio">
      <p style={sectionTitleStyle}>Domicilio declarado</p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <p
          data-testid="solicitud-domicilio-linea"
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: primary ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          {primary || 'Sin domicilio declarado'}
        </p>
        <span
          data-testid="solicitud-domicilio-origen"
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderRadius: 999,
            padding: '3px 8px',
            color: sourceLabel ? 'var(--brand)' : 'var(--warn-text, #b54708)',
            background: sourceLabel
              ? 'rgba(14, 95, 216, 0.1)'
              : 'var(--warn-bg, #fef0c7)',
          }}
        >
          {sourceLabel ?? 'Sin normalizar'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 24px',
        }}
      >
        {ADDRESS_ROWS.filter(
          ({ field }) =>
            REQUIRED_ADDRESS_FIELDS.includes(
              field as (typeof REQUIRED_ADDRESS_FIELDS)[number],
            ) || address[field].trim().length > 0,
        ).map(({ field, label }) => (
          <div key={field}>
            <p style={labelStyle}>{label}</p>
            <p
              data-testid={`solicitud-domicilio-${field}`}
              style={{
                ...valueStyle,
                color: missing.has(field)
                  ? 'var(--err-text, #b42318)'
                  : valueStyle.color,
              }}
            >
              {address[field].trim() || '— falta'}
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={labelStyle}>Ubicación</p>
        {hasPin ? (
          <>
            <p data-testid="solicitud-domicilio-coords" style={valueStyle}>
              {address.latitude?.toFixed(6)}, {address.longitude?.toFixed(6)}
            </p>
            <div style={{ marginTop: 8 }}>
              <AddressMap
                latitude={address.latitude}
                longitude={address.longitude}
                // El revisor VERIFICA; corregir la dirección de otro desde el
                // panel de aprobación sería editar una declaración firmada.
                disabled
                onPinMove={() => {}}
                height={180}
              />
            </div>
          </>
        ) : (
          <p
            data-testid="solicitud-domicilio-sin-coords"
            style={{ ...valueStyle, color: 'var(--warn-text, #b54708)' }}
          >
            Sin coordenadas: Mercado Pago va a ubicar el local sólo por el texto
            de la dirección.
          </p>
        )}
      </div>
    </section>
  );
}

export function SolicitudesPage() {
  const listQuery = useApplicationsList('pending');
  const items = listQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailQuery = useApplicationDetail(selectedId);
  const { approveMutation, rejectMutation } = useApplicationActions();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { showToast } = useToast();
  const [previewDoc, setPreviewDoc] = useState<ApplicationDocument | null>(
    null,
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(doc: ApplicationDocument) {
    if (!selectedId) return;
    setDownloadingId(doc.id);
    try {
      const { url } = await getDocumentSignedUrl(
        selectedId,
        doc.id,
        'attachment',
      );
      // The signed URL already carries `Content-Disposition: attachment`, so
      // navigating to it downloads the file with its original name. The anchor
      // is briefly attached to the DOM because Firefox ignores `click()` on a
      // detached element.
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.applications.document',
        }),
        kind: 'error',
      });
    } finally {
      setDownloadingId(null);
    }
  }

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
                    ['Teléfono', detail.phone ?? '—'],
                    // "Plazas declaradas" YA NO va. Las plazas salieron del
                    // wizard (el dueño no puede saber la capacidad antes de
                    // que la playa exista; la carga después en `/app/config`),
                    // así que para toda solicitud nueva esta fila era un "—"
                    // fijo: ruido en la única pantalla donde se decide aprobar
                    // o rechazar. El dato sigue existiendo en el backend
                    // (`declared_entity.totalSpots` para borradores viejos, y
                    // `approve()` lo lee con `?? 0`): lo que se saca es la
                    // fila, no el campo.
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

              {/* Domicilio estructurado — lo que determina la jurisdicción
                  fiscal del Store en Mercado Pago. */}
              <DomicilioSection
                address={addressFromLocation(detail.location, detail.address)}
              />

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
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 13,
                            color: 'var(--text-2)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {doc.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="pk-btn-icon"
                          icon={<IconEye size={15} />}
                          aria-label={`Previsualizar ${doc.name}`}
                          title="Previsualizar"
                          onClick={() => setPreviewDoc(doc)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="pk-btn-icon"
                          icon={<IconDownload size={15} />}
                          aria-label={`Descargar ${doc.name}`}
                          title="Descargar"
                          loading={downloadingId === doc.id}
                          disabled={downloadingId !== null}
                          onClick={() => void handleDownload(doc)}
                        />
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

      {/* Document preview modal */}
      {selectedId && (
        <DocumentPreviewModal
          applicationId={selectedId}
          doc={previewDoc}
          open={previewDoc !== null}
          onClose={() => setPreviewDoc(null)}
          onDownload={(doc) => void handleDownload(doc)}
        />
      )}

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
