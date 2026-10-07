import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { translateApiError } from '../../../../lib/api/translate';
import {
  getInvoiceReceiverSuggestion,
  listInvoiceReceivers,
  lookupTaxpayer,
} from '../../services/invoices';
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
const RECEIVER_SUGGESTION_TIMEOUT_MS = 5000;

/**
 * El receptor de «Emitir factura» en el detalle del Historial: consumidor
 * final o un CUIT, con la consulta al padrón mientras se tipea y los CUIT ya
 * facturados como sugerencias. Gemelo de `useInvoiceReceiver` del desktop.
 */
export function useInvoiceReceiver(input: {
  tenantId: string;
  entryId: string;
  suggestionEnabled: boolean;
  frozen?: boolean;
}) {
  const { tenantId, entryId, suggestionEnabled, frozen = false } = input;
  const [choice, setChoiceState] = useState<ReceiverChoice>('final');
  const [cuit, setCuit] = useState('');
  const [touched, setTouched] = useState(false);
  const userEditedRef = useRef(false);
  const frozenRef = useRef(false);
  const [userEdited, setUserEdited] = useState(false);
  const [source, setSource] = useState<'mercadopago' | null>(null);
  const [settledSuggestion, setSettledSuggestion] = useState<string | null>(
    null,
  );
  const suggestionScope = `${tenantId}:${entryId}`;
  const identityRef = useRef(suggestionScope);
  const resolvingSuggestion =
    suggestionEnabled && settledSuggestion !== suggestionScope && !userEdited;
  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);
  useEffect(() => {
    if (identityRef.current === suggestionScope) return;
    identityRef.current = suggestionScope;
    userEditedRef.current = false;
    setUserEdited(false);
    setSource(null);
    setChoiceState('final');
    setCuit('');
    setTouched(false);
  }, [suggestionScope]);
  useEffect(() => {
    if (!suggestionEnabled) {
      setSettledSuggestion(null);
      return;
    }
    if (userEditedRef.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
      setSettledSuggestion(suggestionScope);
    }, RECEIVER_SUGGESTION_TIMEOUT_MS);
    void getInvoiceReceiverSuggestion(tenantId, entryId, controller.signal)
      .then(({ cuit: suggestedCuit }) => {
        if (
          controller.signal.aborted ||
          userEditedRef.current ||
          frozenRef.current ||
          !suggestedCuit ||
          !isValidArcaCuit(suggestedCuit)
        )
          return;
        setSource('mercadopago');
        setChoiceState('cuit');
        setCuit(suggestedCuit);
        setTouched(false);
      })
      .catch(() => {
        /* Optional suggestion: keep the usual receiver. */
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledSuggestion(suggestionScope);
        window.clearTimeout(timer);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [suggestionEnabled, tenantId, entryId, suggestionScope]);
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
      userEditedRef.current = true;
      setUserEdited(true);
      setSource(null);
      setChoiceState(next);
      setTouched(false);
    },
    cuit,
    setCuit: (next: string) => {
      userEditedRef.current = true;
      setUserEdited(true);
      setSource(null);
      setCuit(next);
    },
    markTouched: () => setTouched(true),
    lookup,
    source,
    resolvingSuggestion,
    suggestions: suggestionsQuery.data ?? [],
    /**
     * El error aparece al salir del campo o con los 11 dígitos, nunca con el
     * campo vacío: ahí alcanza con la ayuda y el botón deshabilitado.
     */
    visibleCuitError:
      digits.length > 0 && (touched || digits.length >= 11) ? error : null,
    ready: !resolvingSuggestion && isReceiverReady(state),
    cuitToSend: receiverCuitToSend(state),
  };
}

export type InvoiceReceiverState = ReturnType<typeof useInvoiceReceiver>;
