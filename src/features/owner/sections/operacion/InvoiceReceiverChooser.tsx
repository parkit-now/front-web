import { useId } from 'react';
import { Input } from '../../../../shared/components/ui/Input';
import type { ArcaTaxCondition } from '../../services/arca';
import {
  describeTaxpayerLookup,
  formatCuit,
  consumerFinalLetter,
  type ReceiverChoice,
} from './invoiceUtils';
import type { InvoiceReceiverState } from './useInvoiceReceiver';

const OPTIONS: readonly { value: ReceiverChoice; label: string }[] = [
  { value: 'final', label: 'Consumidor Final' },
  { value: 'cuit', label: 'Con CUIT' },
];

/**
 * A quién se factura: consumidor final o el CUIT del cliente. La letra no se
 * elige: con CUIT la decide el padrón de ARCA y se muestra antes de emitir.
 * Gemelo de `InvoiceReceiverChooser` del desktop.
 */
export function InvoiceReceiverChooser({
  receiver,
  emitter,
  disabled,
}: {
  receiver: InvoiceReceiverState;
  /** Condición IVA de la sede: decide la letra a consumidor final. */
  emitter: ArcaTaxCondition | null;
  disabled?: boolean;
}) {
  const listId = useId();
  const consumerLetter = consumerFinalLetter(emitter);
  const notice =
    receiver.choice === 'cuit' && !receiver.visibleCuitError
      ? describeTaxpayerLookup(receiver.lookup)
      : null;

  return (
    <div className="operation-invoice-receiver">
      <div
        className="operation-invoice-chips"
        role="radiogroup"
        aria-label="Receptor de la factura"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            className="operation-invoice-chip"
            aria-checked={receiver.choice === option.value}
            disabled={disabled}
            onClick={() => receiver.setChoice(option.value)}
          >
            {option.value === 'final'
              ? `${option.label} (Factura ${consumerLetter})`
              : option.label}
          </button>
        ))}
      </div>
      {receiver.choice === 'cuit' ? (
        <>
          <Input
            aria-label="CUIT del cliente"
            placeholder="CUIT del cliente (con o sin guiones)"
            inputMode="numeric"
            maxLength={13}
            autoComplete="off"
            autoFocus
            value={receiver.cuit}
            list={receiver.suggestions.length > 0 ? listId : undefined}
            disabled={disabled}
            onChange={(e) => receiver.setCuit(e.target.value)}
            onBlur={receiver.markTouched}
            error={receiver.visibleCuitError ?? undefined}
          />
          {receiver.suggestions.length > 0 ? (
            // Los CUIT ya facturados: el navegador los filtra mientras se
            // tipea y muestra la razón social al lado.
            <datalist id={listId}>
              {receiver.suggestions.map((s) => (
                <option
                  key={s.cuit}
                  value={formatCuit(s.cuit)}
                  label={s.razonSocial ?? undefined}
                />
              ))}
            </datalist>
          ) : null}
          {notice ? (
            <p
              className={`operation-invoice-lookup is-${notice.tone}`}
              role="status"
            >
              {notice.text}
              {notice.detail ? <small>{notice.detail}</small> : null}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
