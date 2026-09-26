import { translateErrorCode } from '../../../../lib/api/translate';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { InvoiceBatchResult } from '../../services/invoices';
import { voucherLabel } from './invoiceUtils';

/** Resultado de «Emitir a consumidor final (n)»: una línea por estadía. */
export function InvoiceBatchResultModal({
  results,
  plateByEntryId,
  onClose,
}: {
  results: InvoiceBatchResult[] | null;
  plateByEntryId: ReadonlyMap<string, string>;
  onClose: () => void;
}) {
  const issued = results?.filter((r) => r.errorCode === null).length ?? 0;
  const total = results?.length ?? 0;

  return (
    <Modal
      open={results !== null}
      onClose={onClose}
      title="Resultado de la emisión"
      width={520}
      footer={<Button onClick={onClose}>Listo</Button>}
    >
      <p className="operation-batch-summary">
        {issued === total
          ? `Se emitieron las ${total} facturas.`
          : `Se emitieron ${issued} de ${total} facturas.`}
      </p>
      <ul className="operation-batch-list">
        {(results ?? []).map((result) => (
          <li key={result.entryId}>
            <strong className="operation-mono">
              {plateByEntryId.get(result.entryId) ?? result.entryId.slice(0, 8)}
            </strong>
            {result.errorCode === null ? (
              <Badge variant="ok">
                {(result.invoice && voucherLabel(result.invoice)) ?? 'Emitida'}
              </Badge>
            ) : (
              <span className="operation-batch-error">
                {translateErrorCode(result.errorCode) ?? 'No se pudo emitir.'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
