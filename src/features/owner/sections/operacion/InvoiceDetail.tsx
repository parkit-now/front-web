import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  translateApiError,
  translateErrorCode,
} from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { fmtMoney } from '../../../../shared/utils/fmt';
import { Switch } from '../../../../shared/components/ui/Switch';
import type { ArcaTaxCondition } from '../../services/arca';
import {
  getInvoiceDocument,
  setEntryManualInvoiceNumber,
  setEntryManuallyInvoiced,
} from '../../services/invoices';
import { renderInvoiceHtml } from './invoiceDocument';
import { InvoiceReceiverChooser } from './InvoiceReceiverChooser';
import {
  canIssueInvoice,
  describeIssueConfirmation,
  expectedLetter,
  invoicePdfTitle,
  formatIsoDay,
  INVOICE_STATE_LABEL,
  INVOICE_STATE_VARIANT,
  receiverDescription,
  voucherLabel,
} from './invoiceUtils';
import type { EntryHistoryRow } from './operationUtils';
import { printInvoice } from './printInvoice';
import { useInvoiceReceiver } from './useInvoiceReceiver';
import { useInvoiceConfirmation } from './useInvoiceConfirmation';
import { ClientContact } from '../clientes/ClientContact';

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
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'pdf' | 'manual' | 'number' | null>(null);
  const [manualNumberDraft, setManualNumberDraft] = useState(
    row.manualInvoiceNumber ?? '',
  );

  useEffect(() => {
    setManualNumberDraft(row.manualInvoiceNumber ?? '');
  }, [row.id, row.manualInvoiceNumber]);
  const confirmation = useInvoiceConfirmation(tenantId, row.id);
  const actionBusy = busy !== null || confirmation.busy;
  // «Emitir factura» abre primero el receptor (consumidor final o CUIT).
  const [issueOpen, setIssueOpen] = useState(false);
  const receiver = useInvoiceReceiver({
    tenantId,
    entryId: row.id,
    plate: row.plate,
    suggestionEnabled: issueOpen,
    frozen: actionBusy || confirmation.snapshot !== null,
  });
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
    await confirmation.confirm((result) => {
      const label = voucherLabel(result) ?? 'La factura';
      if (result.status === 'issued') {
        setIssueOpen(false);
        showToast({ message: `${label} emitida.`, kind: 'success' });
        void queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
      } else {
        showToast({
          message:
            translateErrorCode(result.errorCode) ??
            'La factura no se pudo emitir.',
          kind: 'error',
        });
      }
    });
    onChanged();
  }

  async function downloadPdf() {
    if (!invoice) return;
    setBusy('pdf');
    try {
      const doc = await getInvoiceDocument(tenantId, invoice.id);
      // Los datos llegaron: si algo falla de acá en adelante es del navegador.
      try {
        const qr = await QRCode.toDataURL(doc.qrUrl, {
          width: 200,
          margin: 0,
          errorCorrectionLevel: 'M',
        });
        await printInvoice(
          renderInvoiceHtml(doc, qr),
          invoicePdfTitle({ plate: row.plate, ...invoice }),
        );
      } catch {
        showToast({
          message: 'No se pudo abrir la impresión. Probá de nuevo.',
          kind: 'error',
        });
      }
    } catch (error) {
      showToast({
        message: translateApiError(error, { endpoint: 'invoices.document' }),
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

  async function saveManualNumber() {
    if (
      actionBusy ||
      manualNumberDraft.trim() === (row.manualInvoiceNumber ?? '')
    )
      return;
    setBusy('number');
    try {
      await setEntryManualInvoiceNumber(
        tenantId,
        row,
        manualNumberDraft.trim(),
      );
      showToast({ message: 'Número de factura guardado.', kind: 'success' });
      onChanged();
    } catch (error) {
      showToast({
        message: translateApiError(error, {
          endpoint: 'entries.setManuallyInvoiced',
        }),
        kind: 'error',
      });
    } finally {
      setBusy(null);
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
      {invoiceState === 'issued' ? (
        <ClientContact
          tenantId={tenantId}
          plate={row.plate}
          receiverCuit={
            invoice?.receptorDocTipo === 80 ? invoice.receptorDocNro : null
          }
        />
      ) : null}

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
            disabled={actionBusy}
          />
          {(receiver.choice === 'final' || receiver.cuitToSend) && (
            <ClientContact
              tenantId={tenantId}
              plate={row.plate}
              receiverCuit={receiver.cuitToSend}
            />
          )}
          <div className="operation-invoice-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={actionBusy}
              onClick={() => setIssueOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={confirmation.busy}
              disabled={actionBusy || !receiver.ready}
              onClick={() =>
                void confirmation.open({
                  letter,
                  cuit: receiver.cuitToSend,
                  receiverName:
                    receiver.lookup.status === 'done'
                      ? receiver.lookup.taxpayer.razonSocial
                      : null,
                })
              }
            >
              {letter ? `Emitir Factura ${letter}` : 'Emitir factura'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="operation-invoice-actions">
        {invoiceState === 'issued' ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'pdf'}
              disabled={actionBusy}
              onClick={() => void downloadPdf()}
            >
              Descargar PDF
            </Button>
            <span className="operation-muted">
              Se abre la impresión: elegí «Guardar como PDF».
            </span>
          </>
        ) : null}
        {showIssue && !issueOpen ? (
          <Button
            size="sm"
            disabled={actionBusy}
            onClick={() => setIssueOpen(true)}
          >
            {invoiceState === 'error' ? 'Reintentar' : 'Emitir factura'}
          </Button>
        ) : null}
        {showManual ? (
          <label className="operation-quick-switch">
            <Switch
              checked={invoiceState === 'manual'}
              disabled={actionBusy}
              onChange={(next) => void toggleManual(next)}
              aria-label="Facturada"
            />
            Facturada
          </label>
        ) : null}
      </div>
      {showManual && invoiceState === 'manual' ? (
        <div className="operation-manual-invoice-number">
          <label htmlFor={`manual-invoice-number-${row.id}`}>
            Número de factura
          </label>
          <div>
            <input
              id={`manual-invoice-number-${row.id}`}
              type="text"
              value={manualNumberDraft}
              maxLength={40}
              disabled={actionBusy}
              onChange={(event) => setManualNumberDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void saveManualNumber();
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              title="Guardar número de factura"
              aria-label="Guardar número de factura"
              disabled={
                actionBusy ||
                manualNumberDraft.trim() === (row.manualInvoiceNumber ?? '')
              }
              onClick={() => void saveManualNumber()}
            >
              <Save size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
      {confirmation.snapshot ? (
        <ConfirmDialog
          open
          {...describeIssueConfirmation({
            ...confirmation.snapshot,
            amount: fmtMoney(confirmation.snapshot.amount),
          })}
          loading={confirmation.busy}
          onClose={confirmation.close}
          onConfirm={() => void issue()}
        />
      ) : null}
    </div>
  );
}
