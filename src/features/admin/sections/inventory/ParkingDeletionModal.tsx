import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import {
  useDeletionPreflight,
  useParkingActions,
} from '../../hooks/useParkings';
import type { DeletionPreflight, Parking } from '../../services/parkings';
import { parkingNameMatches } from './parkingNameMatch';

interface Props {
  open: boolean;
  onClose: () => void;
  parking: Parking | null;
}

/** Las filas de conteos, en el orden en que importan al leerlas. */
function damageRows(
  preflight: DeletionPreflight,
): { label: string; value: number; warn?: boolean }[] {
  return [
    { label: 'Autos adentro ahora', value: preflight.carsInside, warn: true },
    {
      label: 'Turnos de caja abiertos',
      value: preflight.openCashSessions,
      warn: true,
    },
    { label: 'Personal con acceso', value: preflight.staff },
    { label: 'Ingresos registrados', value: preflight.entries },
    { label: 'Turnos de caja', value: preflight.cashSessions },
    { label: 'Facturas emitidas', value: preflight.invoices },
    { label: 'Reservas', value: preflight.reservations },
    { label: 'Fotos de patentes', value: preflight.storageObjects },
    { label: 'Registros de auditoría', value: preflight.auditRows },
  ];
}

/**
 * La confirmación del borrado de un estacionamiento.
 *
 * POR QUÉ NO ES EL `ConfirmDialog` COMPARTIDO
 *
 * Su botón de confirmar recibe `loading` pero nunca `disabled`, y acá el botón
 * tiene que estar apagado hasta que el nombre tipeado coincida. Lo usan media
 * docena de pantallas: agregarle un `disabled` para este caso le cambia el
 * contrato a todas.
 *
 * Y el diálogo viejo —un click, sin números— describía lo que iba a borrar
 * mencionando "zonas", que se eliminaron del producto hace cinco meses.
 */
export function ParkingDeletionModal({ open, onClose, parking }: Props) {
  const { deleteMutation } = useParkingActions();
  const preflightQuery = useDeletionPreflight(
    open ? (parking?.id ?? null) : null,
  );
  const [typed, setTyped] = useState('');
  const [graceDays, setGraceDays] = useState(30);

  // El nombre tipeado NO sobrevive a cerrar el modal: si quedara, reabrirlo
  // sobre OTRA fila mostraría el botón ya habilitado.
  useEffect(() => {
    if (!open) {
      setTyped('');
      setGraceDays(30);
    }
  }, [open]);

  if (!parking) return null;

  const preflight = preflightQuery.data;
  const confirmed = parkingNameMatches(typed, parking.name);
  const pending = deleteMutation.isPending;

  const submit = () => {
    if (!confirmed || pending) return;
    deleteMutation.mutate(
      { id: parking.id, body: { confirmName: typed, graceDays } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Dar de baja «${parking.name}»`}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            loading={pending}
            disabled={!confirmed || preflightQuery.isLoading}
          >
            {graceDays === 0 ? 'Dar de baja y borrar' : 'Dar de baja'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0 }}>
          El estacionamiento deja de existir para todo el mundo: desaparece del
          panel del dueño, de la app del conductor y de la caja. Quien lo tenga
          abierto en la computadora de la playa{' '}
          <strong>pierde la sesión</strong> cuando vuelva a tener conexión.
        </p>

        {preflightQuery.isLoading ? (
          <p className="pk-muted" style={{ margin: 0 }}>
            Contando lo que se va a borrar...
          </p>
        ) : preflightQuery.isError ? (
          <p style={{ margin: 0, color: 'var(--danger)' }}>
            No pudimos contar lo que se va a borrar. Probá de nuevo antes de
            confirmar.
          </p>
        ) : preflight ? (
          <>
            {preflight.blockers.length > 0 && (
              // Plata de terceros. No bloquea —la decisión es del admin— pero
              // se lee distinto del resto de los números a propósito.
              <div
                style={{
                  border: '1px solid var(--danger)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <strong style={{ color: 'var(--danger)' }}>
                  Hay plata de terceros sin resolver
                </strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {preflight.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
                <span className="pk-muted">
                  La baja se puede hacer igual, pero la limpieza definitiva no
                  va a correr hasta que esto se resuelva.
                </span>
              </div>
            )}

            <div>
              <strong>Se va a borrar</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {damageRows(preflight)
                  .filter((row) => row.value > 0)
                  .map((row) => (
                    <li
                      key={row.label}
                      style={row.warn ? { color: 'var(--danger)' } : undefined}
                    >
                      {row.label}: <strong>{row.value}</strong>
                    </li>
                  ))}
              </ul>
              {(preflight.mercadoPagoLinked || preflight.arcaLinked) && (
                <p className="pk-muted" style={{ margin: '8px 0 0' }}>
                  Se desvincula{' '}
                  {[
                    preflight.mercadoPagoLinked ? 'Mercado Pago' : null,
                    preflight.arcaLinked ? 'ARCA' : null,
                  ]
                    .filter(Boolean)
                    .join(' y ')}
                  . Restaurar no los vuelve a vincular.
                </p>
              )}
            </div>
          </>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="parking-grace" className="pk-label">
            Cuándo se borra definitivamente
          </label>
          <select
            id="parking-grace"
            className="pk-input"
            value={graceDays}
            onChange={(e) => setGraceDays(Number(e.target.value))}
            disabled={pending}
          >
            <option value={30}>
              En 30 días (se puede restaurar hasta ahí)
            </option>
            <option value={7}>En 7 días</option>
            <option value={0}>En la próxima limpieza — sin vuelta atrás</option>
          </select>
          {graceDays === 0 && (
            <span style={{ color: 'var(--danger)' }}>
              Con esta opción no vas a poder restaurarlo: la próxima corrida del
              job borra la base y las fotos del bucket.
            </span>
          )}
        </div>

        <Input
          label={`Escribí «${parking.name}» para confirmar`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={pending}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </div>
    </Modal>
  );
}
