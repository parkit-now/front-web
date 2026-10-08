import { describe, expect, it } from 'vitest';
import {
  INVOICE_STATE_LABEL,
  canIssueInvoice,
  consumerFinalLetter,
  countInvoiceChips,
  describeTaxpayerLookup,
  expectedLetter,
  formatVoucherNumber,
  invoicePdfTitle,
  isReceiverReady,
  receiverCuitError,
  receiverCuitToSend,
  resolveInvoiceState,
  voucherLabel,
} from './invoiceUtils';

const paid = { leftAt: '2026-09-24T15:30:00.000Z', paidTotal: 1210 };

describe('invoicePdfTitle', () => {
  it('usa número-punto de venta_CAE_patente para el nombre propuesto por el navegador', () => {
    expect(
      invoicePdfTitle({
        plate: 'IXO431',
        cae: '86406602350114',
        ptoVta: 7,
        cbteNro: 9,
      }),
    ).toBe('00000009-0007_86406602350114_IXO431');
    expect(
      invoicePdfTitle({
        plate: 'AB123CD',
        cae: '86390928613357',
        ptoVta: 1,
        cbteNro: 6,
      }),
    ).toBe('00000006-0001_86390928613357_AB123CD');
  });

  it('omite datos ausentes sin separadores sobrantes ni duplicar la extension PDF', () => {
    expect(invoicePdfTitle({ plate: 'IXO431', ptoVta: 7, cbteNro: 9 })).toBe(
      '00000009-0007_IXO431',
    );
    expect(
      invoicePdfTitle({
        plate: 'IXO431',
        cae: '86406602350114',
        ptoVta: 7,
        cbteNro: null,
      }),
    ).toBe('86406602350114_IXO431');
    expect(invoicePdfTitle({ plate: 'IXO431' })).toBe('IXO431');
  });
});

describe('resolveInvoiceState', () => {
  it('manda el estado de la factura de ARCA', () => {
    expect(resolveInvoiceState(paid, { status: 'issued' })).toBe('issued');
    expect(resolveInvoiceState(paid, { status: 'error' })).toBe('error');
    expect(resolveInvoiceState(paid, { status: 'pending' })).toBe('pending');
  });

  it('sin factura (o not_required): sin factura, o facturada a mano', () => {
    expect(resolveInvoiceState(paid, undefined)).toBe('none');
    expect(resolveInvoiceState(paid, { status: 'not_required' })).toBe('none');
    expect(INVOICE_STATE_LABEL.none).toBe('No facturado');
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
describe('receptor con CUIT (gemelo del desktop)', () => {
  const taxpayer = {
    cuit: '30712345671',
    identified: true,
    letter: 'A' as const,
    razonSocial: 'EMPRESA SA',
    condicionIvaReceptorId: 1,
    condicionIva: 'IVA Responsable Inscripto',
    assumed: false,
  };
  const done = { status: 'done' as const, taxpayer };

  it('a consumidor final: B si la sede es RI, C si no', () => {
    expect(consumerFinalLetter('responsable_inscripto')).toBe('B');
    expect(consumerFinalLetter('monotributo')).toBe('C');
    expect(consumerFinalLetter(null)).toBe('C');
  });

  it('manda el CUIT sólo si es válido y el padrón no dijo que no existe', () => {
    const cuit = '30-71234567-1';
    expect(
      receiverCuitToSend({ choice: 'final', cuit, lookup: done }),
    ).toBeUndefined();
    expect(receiverCuitToSend({ choice: 'cuit', cuit, lookup: done })).toBe(
      '30712345671',
    );
    expect(
      receiverCuitToSend({
        choice: 'cuit',
        cuit,
        lookup: {
          status: 'done',
          taxpayer: { ...taxpayer, identified: false },
        },
      }),
    ).toBeUndefined();
    expect(
      receiverCuitToSend({
        choice: 'cuit',
        cuit,
        lookup: { status: 'error', message: 'x' },
      }),
    ).toBe('30712345671');
  });

  it('con CUIT se emite recién cuando el padrón contestó', () => {
    const cuit = '30712345671';
    expect(
      isReceiverReady({ choice: 'cuit', cuit, lookup: { status: 'loading' } }),
    ).toBe(false);
    expect(isReceiverReady({ choice: 'cuit', cuit, lookup: done })).toBe(true);
    expect(
      isReceiverReady({
        choice: 'final',
        cuit: '',
        lookup: { status: 'idle' },
      }),
    ).toBe(true);
  });

  it('la letra esperada', () => {
    expect(
      expectedLetter({
        emitter: 'responsable_inscripto',
        choice: 'cuit',
        lookup: done,
      }),
    ).toBe('A');
    expect(
      expectedLetter({
        emitter: 'responsable_inscripto',
        choice: 'cuit',
        lookup: { status: 'loading' },
      }),
    ).toBeNull();
    expect(
      expectedLetter({ emitter: 'monotributo', choice: 'cuit', lookup: done }),
    ).toBe('C');
  });

  it('describe lo que dijo el padrón', () => {
    expect(describeTaxpayerLookup(done)).toEqual({
      tone: 'success',
      text: 'Factura A · EMPRESA SA',
      detail: 'IVA Responsable Inscripto',
    });
    expect(
      describeTaxpayerLookup({
        status: 'done',
        taxpayer: {
          ...taxpayer,
          identified: false,
          letter: 'B',
          razonSocial: null,
          condicionIvaReceptorId: null,
          condicionIva: null,
        },
      }),
    ).toEqual({
      tone: 'warning',
      text: 'ARCA no tiene datos de ese CUIT.',
      detail: 'Se emite Factura B a consumidor final.',
    });
    expect(receiverCuitError('')).toBe('Ingresá el CUIT del cliente.');
    expect(receiverCuitError('30712345670')).toBe('El CUIT no es válido.');
  });
});
