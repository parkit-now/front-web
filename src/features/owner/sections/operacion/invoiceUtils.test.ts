import { describe, expect, it } from 'vitest';
import { pdfFileName } from '../../services/invoices';
import {
  canIssueInvoice,
  countInvoiceChips,
  formatVoucherNumber,
  resolveInvoiceState,
  voucherLabel,
} from './invoiceUtils';

const paid = { leftAt: '2026-09-24T15:30:00.000Z', paidTotal: 1210 };

describe('resolveInvoiceState', () => {
  it('manda el estado de la factura de ARCA', () => {
    expect(resolveInvoiceState(paid, { status: 'issued' })).toBe('issued');
    expect(resolveInvoiceState(paid, { status: 'error' })).toBe('error');
    expect(resolveInvoiceState(paid, { status: 'pending' })).toBe('pending');
  });

  it('sin factura (o not_required): sin factura, o facturada a mano', () => {
    expect(resolveInvoiceState(paid, undefined)).toBe('none');
    expect(resolveInvoiceState(paid, { status: 'not_required' })).toBe('none');
    expect(
      resolveInvoiceState({ ...paid, manuallyInvoiced: true }, undefined),
    ).toBe('manual');
  });

  it('auto en base o cobro de $0 → no aplica', () => {
    expect(
      resolveInvoiceState({ leftAt: null, paidTotal: null }, undefined),
    ).toBe('na');
    expect(
      resolveInvoiceState(
        { ...paid, paidTotal: 0 },
        { status: 'not_required' },
      ),
    ).toBe('na');
  });
});

describe('countInvoiceChips', () => {
  it('«Sin facturar» cuenta Pendiente + Sin factura + Con error', () => {
    const rows = (
      ['pending', 'none', 'error', 'issued', 'manual', 'na'] as const
    ).map((invoiceState) => ({ invoiceState }));

    expect(countInvoiceChips(rows)).toEqual({ all: 6, unbilled: 3 });
  });
});

describe('formatVoucherNumber / voucherLabel', () => {
  it('rellena punto de venta y número como ARCA', () => {
    expect(formatVoucherNumber(1, 123)).toBe('0001-00000123');
    expect(formatVoucherNumber(1, null)).toBeNull();
  });

  it('arma la etiqueta con la letra', () => {
    expect(voucherLabel({ cbteTipo: 6, ptoVta: 1, cbteNro: 5 })).toBe(
      'Factura B 0001-00000005',
    );
    expect(voucherLabel({ cbteTipo: 11, ptoVta: null, cbteNro: null })).toBe(
      'Factura C',
    );
  });
});

describe('canIssueInvoice', () => {
  it('sólo con ARCA vinculada y una estadía sin facturar', () => {
    expect(canIssueInvoice('none', true)).toBe(true);
    expect(canIssueInvoice('error', true)).toBe(true);
    expect(canIssueInvoice('issued', true)).toBe(false);
    expect(canIssueInvoice('none', false)).toBe(false);
  });
});

describe('pdfFileName', () => {
  it('siempre termina en .pdf', () => {
    expect(pdfFileName('AB123CD-86390928613357-0001-00000006.pdf', 'x')).toBe(
      'AB123CD-86390928613357-0001-00000006.pdf',
    );
    expect(pdfFileName('AB123CD-863-0001-00000006', 'x')).toBe(
      'AB123CD-863-0001-00000006.pdf',
    );
    expect(pdfFileName(null, 'AB123CD-863-0001-00000006')).toBe(
      'AB123CD-863-0001-00000006.pdf',
    );
  });
});
