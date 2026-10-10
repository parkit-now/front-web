import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { fmtMoney } from '../../../../shared/utils/fmt';
import type { ReactNode } from 'react';

export type InvoiceBatchPreviewItem = {
  entryId: string;
  plate: string;
  ticketNumber: number | null;
  amount: number;
};

export function InvoiceBatchConfirmModal({
  items,
  loading,
  onClose,
  onConfirm,
  issuerSelection,
  letter,
}: {
  items: readonly InvoiceBatchPreviewItem[] | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  issuerSelection?: ReactNode;
  letter?: 'B' | 'C';
}) {
  const total = items?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  return (
    <Modal
      open={items !== null}
      onClose={loading ? () => undefined : onClose}
      title="Confirmar emisión"
      width={580}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            onClick={onConfirm}
            disabled={!items?.length}
          >
            Emitir {items?.length ?? 0} facturas
          </Button>
        </>
      }
    >
      {issuerSelection}
      <p className="operation-batch-confirm-intro">
        Se emitirán a consumidor final las siguientes facturas
        {letter ? ` ${letter}` : ''}:
      </p>
      <div className="operation-batch-confirm-list" role="list">
        {items?.map((item) => (
          <div
            className="operation-batch-confirm-row"
            role="listitem"
            key={item.entryId}
          >
            <div>
              <strong>{item.plate}</strong>
              {item.ticketNumber != null ? (
                <span>Ticket #{item.ticketNumber}</span>
              ) : null}
            </div>
            <strong className="operation-mono">{fmtMoney(item.amount)}</strong>
          </div>
        ))}
      </div>
      <div className="operation-batch-confirm-total">
        <strong>Total</strong>
        <strong className="operation-mono">{fmtMoney(total)}</strong>
      </div>
      <p className="operation-batch-confirm-note">
        Una factura emitida no se puede anular desde Parkit. Si cambió algún
        importe, esa factura no se emitirá.
      </p>
    </Modal>
  );
}
