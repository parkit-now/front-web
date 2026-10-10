import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Save } from 'lucide-react';
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
  setEntryExternalInvoice,
  setEntryManualInvoiceNumber,
  setEntryManuallyInvoiced,
  type Invoice,
} from '../../services/invoices';
import { correctEntry, type Entry } from '../../services/operations';
import { renderInvoiceHtml } from './invoiceDocument';
import { InvoiceReceiverChooser } from './InvoiceReceiverChooser';
import {
  canIssueInvoice,
  describeIssueConfirmation,
  expectedLetter,
  formatExternalInvoice,
  invoicePdfTitle,
  formatIsoDay,
  INVOICE_STATE_LABEL,
  INVOICE_STATE_VARIANT,
  receiverDescription,
  voucherLabel,
} from './invoiceUtils';
import type { EntryHistoryRow } from './operationUtils';
import { printInvoice } from './printInvoice';
import { isValidArcaCuit, normalizeArcaCuit } from '../integraciones/arca/cuit';
import { useInvoiceReceiver } from './useInvoiceReceiver';
import { useInvoiceConfirmation } from './useInvoiceConfirmation';
import { ClientContact } from '../clientes/ClientContact';
import {
  InvoiceAccountSelector,
  invoiceAccountLabel,
  useInvoiceAccountSelection,
} from './InvoiceAccountSelector';

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
  paymentModeAllowed,
  canManage = false,
  onChanged,
}: {
  row: EntryHistoryRow;
  tenantId: string;
  arca: ArcaInvoicing;
  /** Condición IVA de la sede: decide la letra a consumidor final. */
  emitter: ArcaTaxCondition | null;
  paymentModeAllowed: boolean;
  canManage?: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const accountSelection = useInvoiceAccountSelection(
    tenantId,
    row.invoice?.arcaAccountId,
    row.id,
  );
  const selectedAccount = accountSelection.account;
  const selectedEmitter =
    selectedAccount?.condicionIva ??
    (accountSelection.accountId ? null : emitter);
  const emitterLocked = invoiceEmitterLocked(row);
  const [externalAccountChoice, setExternalAccountChoice] = useState<string>();
  useEffect(() => {
    setExternalAccountChoice(undefined);
  }, [row.id, tenantId]);
  const externalAccountId =
    externalAccountChoice ??
    row.manualInvoiceArcaAccountId ??
    accountSelection.accounts.find((a) => a.role === 'primary')?.id;
  const [busy, setBusy] = useState<
    'pdf' | 'manual' | 'number' | 'reminder' | null
  >(null);
  const [manualNumberDraft, setManualNumberDraft] = useState(
    row.manualInvoiceNumber ?? '',
  );
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalOtherIssuer, setExternalOtherIssuer] = useState(
    !row.manualInvoiceArcaAccountId &&
      Boolean(row.manualInvoiceIssuerCuit || row.manualInvoiceIssuerName),
  );
  const [externalIssuerCuit, setExternalIssuerCuit] = useState(
    row.manualInvoiceIssuerCuit ?? '',
  );
  const [externalIssuerName, setExternalIssuerName] = useState(
    row.manualInvoiceIssuerName ?? '',
  );
  const normalizedIssuerCuit = normalizeArcaCuit(externalIssuerCuit);
  const externalIssuerValid =
    !externalOtherIssuer ||
    (Boolean(normalizedIssuerCuit || externalIssuerName.trim()) &&
      (!normalizedIssuerCuit || isValidArcaCuit(normalizedIssuerCuit)));
  const [removeExternalOpen, setRemoveExternalOpen] = useState(false);
  const [externalType, setExternalType] = useState<'A' | 'B' | 'C'>(
    (row.manualInvoiceType as 'A' | 'B' | 'C') ?? 'C',
  );
  const [externalPoint, setExternalPoint] = useState(
    row.manualInvoicePointOfSale ?? '',
  );
  const [externalNumber, setExternalNumber] = useState(
    row.manualInvoiceNumber ?? '',
  );

  useEffect(() => {
    setManualNumberDraft(row.manualInvoiceNumber ?? '');
    setExternalType((row.manualInvoiceType as 'A' | 'B' | 'C') ?? 'C');
    setExternalPoint(row.manualInvoicePointOfSale ?? '');
    setExternalNumber(row.manualInvoiceNumber ?? '');
  }, [
    row.id,
    row.manualInvoiceNumber,
    row.manualInvoiceType,
    row.manualInvoicePointOfSale,
  ]);
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
    arcaAccountId: accountSelection.accountId,
  });
  const letter = expectedLetter({
    emitter: selectedEmitter,
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
    void onChanged();
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
      await onChanged();
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
      await onChanged();
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

  async function saveExternalInvoice() {
    if (
      actionBusy ||
      !externalIssuerValid ||
      !/^\d{1,5}$/.test(externalPoint) ||
      !/^\d{1,8}$/.test(externalNumber)
    )
      return;
    setBusy('manual');
    try {
      const updated = await setEntryExternalInvoice(tenantId, row, {
        manualInvoiceType: externalType,
        manualInvoicePointOfSale: externalPoint,
        manualInvoiceNumber: externalNumber,
        ...(externalOtherIssuer
          ? {
              manualInvoiceArcaAccountId: null,
              manualInvoiceIssuerCuit: normalizedIssuerCuit || null,
              manualInvoiceIssuerName: externalIssuerName.trim() || null,
            }
          : { manualInvoiceArcaAccountId: externalAccountId }),
      });
      applyExternalInvoiceResult(updated);
      setExternalOpen(false);
      showToast({ message: 'Factura externa registrada.', kind: 'success' });
      await onChanged();
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

  async function removeExternalInvoice() {
    setBusy('manual');
    try {
      const updated = await setEntryExternalInvoice(tenantId, row, null);
      applyExternalInvoiceResult(updated);
      setRemoveExternalOpen(false);
      setExternalOpen(false);
      showToast({
        message: 'Registro de factura externa quitado.',
        kind: 'success',
      });
      await onChanged();
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

  function applyExternalInvoiceResult(updated: Entry) {
    queryClient.setQueryData<Entry[]>(
      ['owner-operations', tenantId, 'entries'],
      (entries) =>
        entries?.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
    queryClient.setQueryData<Invoice[]>(
      ['owner-operations', tenantId, 'invoices'],
      (invoices) =>
        invoices?.map((item) =>
          item.entryId === updated.id &&
          item.status !== 'issued' &&
          item.status !== 'issuing'
            ? {
                ...item,
                status: 'not_required',
                errorCode: null,
                errorMessage: null,
              }
            : item,
        ),
    );
  }

  async function setInvoicePending(next: boolean) {
    if (actionBusy || !showReminder || next === (invoiceState === 'pending'))
      return;
    setBusy('reminder');
    try {
      await correctEntry(tenantId, row, { invoicePending: next });
      await onChanged();
      showToast({
        message: next
          ? 'Factura marcada como pendiente.'
          : 'Factura marcada como no facturada.',
        kind: 'success',
      });
    } catch (error) {
      showToast({ message: translateApiError(error), kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  // Sin ARCA, lo único que hay es el checkbox «Facturada» (lo que el dueño
  // facturó por su cuenta). Con una factura de ARCA de por medio, no se ofrece.
  const showManual =
    arca === 'none' && (invoiceState === 'none' || invoiceState === 'manual');
  const showExternal =
    canManage &&
    arca !== 'none' &&
    (invoiceState === 'none' ||
      invoiceState === 'pending' ||
      invoiceState === 'error' ||
      invoiceState === 'manual');
  const externalSaved = showExternal && row.manuallyInvoiced;
  const showIssue =
    canIssueInvoice(invoiceState, arca !== 'none') &&
    paymentModeAllowed &&
    !row.manuallyInvoiced &&
    !externalOpen &&
    (!selectedAccount || selectedAccount.role !== 'secondary' || canManage);
  const showReminder =
    canManage &&
    Boolean(row.leftAt) &&
    (row.paidTotal ?? 0) > 0 &&
    !row.manuallyInvoiced &&
    (invoiceState === 'none' || invoiceState === 'pending');

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
        {externalSaved ? (
          <Item label="Comprobante externo">
            {formatExternalInvoice(row) ?? 'Registrado fuera de Parkit'}
          </Item>
        ) : null}
      </div>
      {row.manuallyInvoiced &&
      (row.manualInvoiceIssuerCuit || row.manualInvoiceIssuerName) ? (
        <p className="operation-muted">
          Emisor: {row.manualInvoiceIssuerName ?? ''}
          {row.manualInvoiceIssuerCuit ? (
            <> · CUIT {row.manualInvoiceIssuerCuit}</>
          ) : null}
        </p>
      ) : row.invoice?.emisorCuit ? (
        <p className="operation-muted">
          Emisor: {row.invoice.emisorRazonSocial ?? ''} · CUIT{' '}
          {row.invoice.emisorCuit}
        </p>
      ) : null}
      {canManage &&
      (showIssue || invoiceState === 'issuing') &&
      (accountSelection.accounts.length > 1 ||
        (accountSelection.accountId && !selectedAccount)) ? (
        <InvoiceAccountSelector
          accounts={accountSelection.accounts}
          value={accountSelection.accountId}
          disabled={
            actionBusy || emitterLocked || confirmation.snapshot !== null
          }
          onChange={(id) => {
            confirmation.close();
            accountSelection.select(id);
          }}
        />
      ) : null}
      {showReminder ? (
        <div
          className="operation-invoice-reminder"
          aria-label="Seguimiento de factura"
        >
          <span>Seguimiento</span>
          <div role="group" aria-label="Estado de seguimiento">
            <button
              type="button"
              className={invoiceState === 'none' ? 'active' : ''}
              aria-pressed={invoiceState === 'none'}
              disabled={actionBusy}
              onClick={() => void setInvoicePending(false)}
            >
              <BellOff size={15} aria-hidden="true" /> No facturado
            </button>
            <button
              type="button"
              className={invoiceState === 'pending' ? 'active' : ''}
              aria-pressed={invoiceState === 'pending'}
              disabled={actionBusy}
              onClick={() => void setInvoicePending(true)}
            >
              <Bell size={15} aria-hidden="true" /> Pendiente
            </button>
          </div>
        </div>
      ) : null}
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
            emitter={selectedEmitter}
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
              disabled={
                actionBusy ||
                !receiver.ready ||
                accountSelection.loading ||
                !selectedAccount ||
                selectedAccount.status !== 'linked'
              }
              onClick={() =>
                void confirmation.open({
                  letter,
                  arcaAccountId: accountSelection.accountId,
                  issuerLabel: selectedAccount
                    ? invoiceAccountLabel(selectedAccount)
                    : undefined,
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
        {showExternal && !externalOpen ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={actionBusy}
            onClick={() => {
              setIssueOpen(false);
              setExternalOtherIssuer(
                !row.manualInvoiceArcaAccountId &&
                  Boolean(
                    row.manualInvoiceIssuerCuit || row.manualInvoiceIssuerName,
                  ),
              );
              setExternalIssuerCuit(row.manualInvoiceIssuerCuit ?? '');
              setExternalIssuerName(row.manualInvoiceIssuerName ?? '');
              setExternalAccountChoice(undefined);
              setExternalOpen(true);
            }}
          >
            {externalSaved
              ? 'Editar factura externa'
              : 'Registrar factura externa'}
          </Button>
        ) : null}
        {externalSaved && !externalOpen ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={actionBusy}
            onClick={() => setRemoveExternalOpen(true)}
          >
            Quitar registro
          </Button>
        ) : null}
      </div>
      {showExternal && externalOpen ? (
        <div className="operation-external-invoice">
          <label className="operation-external-issuer-toggle">
            <input
              type="checkbox"
              checked={externalOtherIssuer}
              disabled={actionBusy}
              onChange={(event) => setExternalOtherIssuer(event.target.checked)}
            />
            Factura de otro emisor
          </label>
          {externalOtherIssuer ? (
            <div className="operation-external-issuer-fields">
              <label>
                CUIT del emisor
                <input
                  className="pk-input"
                  value={externalIssuerCuit}
                  inputMode="numeric"
                  maxLength={32}
                  placeholder="20-12345678-6"
                  disabled={actionBusy}
                  aria-invalid={Boolean(
                    normalizedIssuerCuit &&
                    !isValidArcaCuit(normalizedIssuerCuit),
                  )}
                  onChange={(event) =>
                    setExternalIssuerCuit(event.target.value)
                  }
                />
              </label>
              <label>
                Nombre o razón social
                <input
                  className="pk-input"
                  value={externalIssuerName}
                  maxLength={180}
                  disabled={actionBusy}
                  onChange={(event) =>
                    setExternalIssuerName(event.target.value)
                  }
                />
              </label>
              {normalizedIssuerCuit &&
              !isValidArcaCuit(normalizedIssuerCuit) ? (
                <p className="operation-external-issuer-error" role="alert">
                  El CUIT no es válido.
                </p>
              ) : null}
            </div>
          ) : (
            <InvoiceAccountSelector
              accounts={accountSelection.accounts}
              value={externalAccountId}
              disabled={actionBusy}
              onChange={setExternalAccountChoice}
            />
          )}
          <div className="operation-external-invoice-fields">
            <label>
              Tipo
              <select
                className="pk-input"
                value={externalType}
                disabled={actionBusy}
                onChange={(event) =>
                  setExternalType(event.target.value as 'A' | 'B' | 'C')
                }
              >
                <option value="A">Factura A</option>
                <option value="B">Factura B</option>
                <option value="C">Factura C</option>
              </select>
            </label>
            <label>
              Punto de venta
              <input
                className="pk-input"
                inputMode="numeric"
                maxLength={5}
                value={externalPoint}
                disabled={actionBusy}
                onChange={(event) =>
                  setExternalPoint(event.target.value.replace(/\D/g, ''))
                }
              />
            </label>
            <label>
              Número
              <input
                className="pk-input"
                inputMode="numeric"
                maxLength={8}
                value={externalNumber}
                disabled={actionBusy}
                onChange={(event) =>
                  setExternalNumber(event.target.value.replace(/\D/g, ''))
                }
              />
            </label>
          </div>
          <div className="operation-invoice-actions">
            <Button
              variant="secondary"
              size="sm"
              disabled={actionBusy}
              onClick={() => setExternalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={busy === 'manual'}
              disabled={
                actionBusy ||
                !externalIssuerValid ||
                !/^\d{1,5}$/.test(externalPoint) ||
                !/^\d{1,8}$/.test(externalNumber) ||
                (!externalOtherIssuer &&
                  !accountSelection.accounts.some(
                    (a) => a.id === externalAccountId,
                  ))
              }
              onClick={() => void saveExternalInvoice()}
            >
              Guardar factura externa
            </Button>
          </div>
        </div>
      ) : null}
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
      <ConfirmDialog
        open={removeExternalOpen}
        title="Quitar factura externa"
        message="Parkit volverá a mostrar esta estadía como no facturada. Esto no modifica la factura emitida en ARCA."
        confirmLabel="Quitar registro"
        destructive
        loading={busy === 'manual'}
        onClose={() => setRemoveExternalOpen(false)}
        onConfirm={() => void removeExternalInvoice()}
      />
    </div>
  );
}

function invoiceEmitterLocked(row: EntryHistoryRow): boolean {
  return (
    row.invoiceState === 'issued' ||
    row.invoiceState === 'issuing' ||
    row.invoice?.cbteNro != null
  );
}
