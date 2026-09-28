import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  translateApiError,
  translateErrorCode,
} from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Switch } from '../../../../shared/components/ui/Switch';
import { saveBlob } from '../../../../shared/utils/download';
import type { ArcaTaxCondition } from '../../services/arca';
import {
  downloadInvoicePdf,
  issueInvoice,
  setEntryManuallyInvoiced,
} from '../../services/invoices';
import { InvoiceReceiverChooser } from './InvoiceReceiverChooser';
import {
  canIssueInvoice,
  expectedLetter,
  formatIsoDay,
  formatVoucherNumber,
  INVOICE_STATE_LABEL,
  INVOICE_STATE_VARIANT,
  receiverDescription,
  voucherLabel,
} from './invoiceUtils';
import type { EntryHistoryRow } from './operationUtils';
import { useInvoiceReceiver } from './useInvoiceReceiver';

/** Cómo factura la sede: con ARCA (vinculada o con el certificado vencido) o no. */
export type ArcaInvoicing = 'linked' | 'cert_expired' | 'none';

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="operation-detail-item">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/**
 * Bloque «Factura» del detalle de un cobro en el Historial: el comprobante y
 * lo que se puede hacer según el estado (emitir, reintentar, bajar el PDF o,
 * sin ARCA, marcarla facturada a mano).
 */
export function InvoiceDetail({
  row,
  tenantId,
  arca,
  emitter,
  onChanged,
}: {
  row: EntryHistoryRow;
  tenantId: string;
  arca: ArcaInvoicing;
  /** Condición IVA de la sede: decide la letra a consumidor final. */
  emitter: ArcaTaxCondition | null;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<'issue' | 'pdf' | 'manual' | null>(null);
  // «Emitir factura» abre primero el receptor (consumidor final o CUIT).
  const [issueOpen, setIssueOpen] = useState(false);
  const receiver = useInvoiceReceiver(tenantId);
  const letter = expectedLetter({
    emitter,
    choice: receiver.choice,
    lookup: receiver.lookup,
  });
  const { invoice, invoiceState } = row;
  const voucher = invoice ? voucherLabel(invoice) : null;
  const hasVoucher = invoiceState === 'issued' || invoiceState === 'issuing';
  const errorText =
    invoice && (invoiceState === 'error' || invoiceState === 'pending')
      ? (translateErrorCode(invoice.errorCode) ??
        (invoiceState === 'error' ? 'No se pudo emitir.' : null))
      : null;

  async function issue() {
    setBusy('issue');
    try {
      const result = await issueInvoice(tenantId, row.id, receiver.cuitToSend);
      const label = voucherLabel(result) ?? 'La factura';
      if (result.status === 'issued') {
        setIssueOpen(false);
        showToast({ message: `${label} emitida.`, kind: 'success' });
      } else {
        showToast({
          message:
            translateErrorCode(result.errorCode) ??
            'La factura no se pudo emitir.',
          kind: 'error',
        });
      }
    } catch (error) {
      showToast({
        message: translateApiError(error, { endpoint: 'invoices.issue' }),
        kind: 'error',
      });
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  async function downloadPdf() {
    if (!invoice) return;
    setBusy('pdf');
    try {
      const number = formatVoucherNumber(invoice.ptoVta, invoice.cbteNro);
      const { blob, fileName } = await downloadInvoicePdf(
        tenantId,
        invoice.id,
        [row.plate, invoice.cae, number].filter(Boolean).join('-'),
      );
      saveBlob(blob, fileName);
    } catch (error) {
      showToast({
        message: translateApiError(error, { endpoint: 'invoices.pdf' }),
        kind: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleManual(next: boolean) {
    setBusy('manual');
    try {
      await setEntryManuallyInvoiced(tenantId, row, next);
    } catch (error) {
      showToast({
        message: translateApiError(error, {
          endpoint: 'entries.setManuallyInvoiced',
        }),
        kind: 'error',
      });
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  // Sin ARCA, lo único que hay es el checkbox «Facturada» (lo que el dueño
  // facturó por su cuenta). Con una factura de ARCA de por medio, no se ofrece.
  const showManual =
    arca === 'none' && (invoiceState === 'none' || invoiceState === 'manual');
  const showIssue = canIssueInvoice(invoiceState, arca !== 'none');

  return (
    <div className="operation-invoice">
      <h3 className="operation-panel-title" style={{ fontSize: 15 }}>
        Factura
      </h3>
      <div className="operation-detail-list" style={{ marginTop: 6 }}>
        <Item label="Estado">
          <Badge variant={INVOICE_STATE_VARIANT[invoiceState]}>
            {INVOICE_STATE_LABEL[invoiceState]}
          </Badge>
        </Item>
        {hasVoucher && voucher ? (
          <Item label="Comprobante">
            <span className="operation-mono">{voucher}</span>
          </Item>
        ) : null}
        {invoice?.cae ? (
          <Item label="CAE">
            <span className="operation-mono">{invoice.cae}</span>
          </Item>
        ) : null}
        {invoice?.caeVto ? (
          <Item label="Vencimiento del CAE">
            {formatIsoDay(invoice.caeVto)}
          </Item>
        ) : null}
        {invoice && hasVoucher ? (
          <Item label="Receptor">{receiverDescription(invoice)}</Item>
        ) : null}
      </div>

      {errorText ? (
        <div className="operation-invoice-error" role="status">
          <p>{errorText}</p>
          {invoice?.errorCode === 'INVOICE_REJECTED' && invoice.errorMessage ? (
            <details>
              <summary>Detalle de ARCA</summary>
              <p className="operation-mono">{invoice.errorMessage}</p>
            </details>
          ) : null}
          {invoice?.errorCode === 'ARCA_CERT_EXPIRED' ? (
            <Link
              to="../integraciones/arca/renovar"
              className="pk-btn pk-btn-secondary pk-btn-sm"
              style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
            >
              Renovar certificado
            </Link>
          ) : null}
        </div>
      ) : null}

      {showIssue && issueOpen ? (
        <div className="operation-invoice-issue">
          <InvoiceReceiverChooser
            receiver={receiver}
            emitter={emitter}
            disabled={busy !== null}
          />
          <div className="operation-invoice-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => setIssueOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={busy === 'issue'}
              disabled={busy !== null || !receiver.ready}
              onClick={() => void issue()}
            >
              {letter ? `Emitir Factura ${letter}` : 'Emitir factura'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="operation-invoice-actions">
        {invoiceState === 'issued' ? (
          <Button
            variant="secondary"
            size="sm"
            loading={busy === 'pdf'}
            disabled={busy !== null}
            onClick={() => void downloadPdf()}
          >
            Descargar PDF
          </Button>
        ) : null}
        {showIssue && !issueOpen ? (
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => setIssueOpen(true)}
          >
            {invoiceState === 'error' ? 'Reintentar' : 'Emitir factura'}
          </Button>
        ) : null}
        {showManual ? (
          <label className="operation-quick-switch">
            <Switch
              checked={invoiceState === 'manual'}
              disabled={busy !== null}
              onChange={(next) => void toggleManual(next)}
              aria-label="Facturada"
            />
            Facturada
          </label>
        ) : null}
      </div>
    </div>
  );
}
