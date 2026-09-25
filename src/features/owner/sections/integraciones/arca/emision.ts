import type {
  PaymentMethodInvoiceMode,
  PaymentMethodSummary,
} from '../../../services/entities';

/**
 * Lógica pura de "Configurar emisión": qué cambió en la tabla de medios de
 * pago y si hay que guardar la alícuota de IVA. Separada del componente para
 * poder probarla sin DOM, igual que el resto de `validation.ts` en esta
 * carpeta.
 */

/** Borrador en memoria: `invoiceMode` elegido por el dueño para cada medio. */
export type InvoiceModeDraft = Record<string, PaymentMethodInvoiceMode>;

/** Arma el borrador inicial a partir de los medios de pago tal como llegaron. */
export function buildInvoiceModeDraft(
  methods: readonly PaymentMethodSummary[],
): InvoiceModeDraft {
  const draft: InvoiceModeDraft = {};
  for (const method of methods) {
    draft[method.id] = method.invoiceMode;
  }
  return draft;
}

export type InvoiceModeChange = {
  id: string;
  invoiceMode: PaymentMethodInvoiceMode;
};

/**
 * Sólo los medios cuyo `invoiceMode` en el borrador quedó distinto del que
 * trajo el backend. Guardar TODA la tabla en cada "Guardar" mandaría PATCH de
 * medios que el dueño ni tocó, y con eso una carrera con otra pestaña (o el
 * propio backend recalculando por otro lado) pisa un cambio ajeno sin que
 * nadie lo haya pedido acá.
 */
export function diffInvoiceModes(
  original: readonly PaymentMethodSummary[],
  draft: InvoiceModeDraft,
): InvoiceModeChange[] {
  const changes: InvoiceModeChange[] = [];
  for (const method of original) {
    const next = draft[method.id];
    if (next !== undefined && next !== method.invoiceMode) {
      changes.push({ id: method.id, invoiceMode: next });
    }
  }
  return changes;
}

/**
 * Si la alícuota de IVA cargada difiere de la que tiene guardada la cuenta.
 * `draft` es el string del input; una entrada vacía o no numérica NO cuenta
 * como cambio (el formulario ya la marca inválida antes de llegar acá).
 */
export function didIvaRateChange(
  originalIvaRate: number,
  draftIvaRate: string,
): boolean {
  const trimmed = draftIvaRate.trim();
  if (!trimmed) return false;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return false;
  return parsed !== originalIvaRate;
}

/** Texto de la columna "Qué pasa al cobrar", según el modo elegido. */
export function describeInvoiceEffect(mode: PaymentMethodInvoiceMode): string {
  switch (mode) {
    case 'none':
      return 'No se factura automáticamente; se puede emitir a pedido.';
    case 'auto':
      return 'Se emite la factura al confirmar el pago.';
    case 'manual':
      return 'Queda pendiente para emitirla desde el Historial.';
  }
}
