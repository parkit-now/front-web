import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { fmtMoney0 } from '../../../../shared/utils/fmt';

export const REASON_MAX_LENGTH = 500;

interface ReasonDialogProps {
  open: boolean;
  kind: 'reject' | 'cancel';
  plate: string;
  /** Lo que se le devuelve al conductor (siempre el total). */
  refundArs: number;
  loading: boolean;
  /** Error de la última vez que se intentó, ya traducido. */
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

const COPY = {
  reject: {
    title: 'Rechazar reserva',
    label: 'Motivo (lo ve el conductor)',
    placeholder: 'Ej.: Playa completa por un evento',
    confirm: 'Rechazar y reembolsar',
  },
  cancel: {
    title: 'Cancelar reserva',
    label: 'Motivo de cancelación (lo ve el conductor)',
    placeholder: 'Ej.: Corte de luz en el edificio',
    confirm: 'Cancelar y reembolsar',
  },
} as const;

/** Pide el motivo (obligatorio) antes de rechazar o cancelar y avisa cuánto se devuelve. */
export function ReasonDialog({
  open,
  kind,
  plate,
  refundArs,
  loading,
  error,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const copy = COPY[kind];
  const trimmed = reason.trim();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${copy.title} · ${plate}`}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Volver
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label htmlFor="reservation-reason" className="pk-label">
          {copy.label}
          <span aria-hidden style={{ color: 'var(--err, #b42318)' }}>
            {' '}
            *
          </span>
        </label>
        <textarea
          id="reservation-reason"
          className="pk-input"
          rows={3}
          maxLength={REASON_MAX_LENGTH}
          required
          value={reason}
          placeholder={copy.placeholder}
          onChange={(e) => setReason(e.target.value)}
          style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
        />
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
          Le devolvemos <strong>{fmtMoney0(refundArs)}</strong> al conductor por
          Mercado Pago. El reembolso siempre es total.
        </p>
        {error ? (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 13, color: 'var(--err, #b42318)' }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
