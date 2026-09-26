import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { translateApiError } from '../../../../lib/api/translate';
import { listInvoiceReceivers, lookupTaxpayer } from '../../services/invoices';
import { isValidArcaCuit, normalizeArcaCuit } from '../integraciones/arca/cuit';
import {
  isReceiverReady,
  receiverCuitError,
  receiverCuitToSend,
  type ReceiverChoice,
  type TaxpayerLookup,
} from './invoiceUtils';

/** Espera después de la última tecla antes de consultar el padrón. */
const LOOKUP_DEBOUNCE_MS = 250;

/**
 * El receptor de «Emitir factura» en el detalle del Historial: consumidor
 * final o un CUIT, con la consulta al padrón mientras se tipea y los CUIT ya
 * facturados como sugerencias. Gemelo de `useInvoiceReceiver` del desktop.
 */
export function useInvoiceReceiver(tenantId: string) {
  const [choice, setChoiceState] = useState<ReceiverChoice>('final');
  const [cuit, setCuit] = useState('');
  const [touched, setTouched] = useState(false);
  const digits = normalizeArcaCuit(cuit);
  const [debounced, setDebounced] = useState(digits);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebounced(digits),
      LOOKUP_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [digits]);

  const wantsCuit = choice === 'cuit';
  const lookupEnabled =
    wantsCuit && isValidArcaCuit(digits) && debounced === digits;
  const taxpayerQuery = useQuery({
    queryKey: ['arca', 'taxpayer', tenantId, debounced],
    queryFn: () => lookupTaxpayer(tenantId, debounced),
    enabled: Boolean(tenantId) && lookupEnabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const suggestionsQuery = useQuery({
    queryKey: ['arca', 'invoice-receivers', tenantId],
    queryFn: () => listInvoiceReceivers(tenantId),
    enabled: Boolean(tenantId) && wantsCuit,
    staleTime: 60_000,
  });

  let lookup: TaxpayerLookup = { status: 'idle' };
  if (wantsCuit && isValidArcaCuit(digits)) {
    if (!lookupEnabled || taxpayerQuery.isFetching) {
      lookup = { status: 'loading' };
    } else if (taxpayerQuery.data) {
      lookup = { status: 'done', taxpayer: taxpayerQuery.data };
    } else if (taxpayerQuery.error) {
      lookup = {
        status: 'error',
        message: translateApiError(taxpayerQuery.error, {
          endpoint: 'invoices.lookupTaxpayer',
        }),
      };
    } else {
      lookup = { status: 'loading' };
    }
  }

  const state = { choice, cuit, lookup };
  const error = wantsCuit ? receiverCuitError(cuit) : null;
  return {
    choice,
    setChoice: (next: ReceiverChoice) => {
      setChoiceState(next);
      setTouched(false);
    },
    cuit,
    setCuit,
    markTouched: () => setTouched(true),
    lookup,
    suggestions: suggestionsQuery.data ?? [],
    /**
     * El error aparece al salir del campo o con los 11 dígitos, nunca con el
     * campo vacío: ahí alcanza con la ayuda y el botón deshabilitado.
     */
    visibleCuitError:
      digits.length > 0 && (touched || digits.length >= 11) ? error : null,
    ready: isReceiverReady(state),
    cuitToSend: receiverCuitToSend(state),
  };
}

export type InvoiceReceiverState = ReturnType<typeof useInvoiceReceiver>;
