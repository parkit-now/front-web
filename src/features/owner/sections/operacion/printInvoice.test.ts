import { describe, expect, it } from 'vitest';
import { printableInvoiceHtml } from './printInvoice';
import { invoicePdfTitle } from './invoiceUtils';

const HTML =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FACTURA A 00002-00000001</title><style></style></head><body></body></html>';

describe('printableInvoiceHtml', () => {
  it('usa el nombre del archivo como título (lo que propone «Guardar como PDF»)', () => {
    const html = printableInvoiceHtml(
      HTML,
      invoicePdfTitle({
        plate: 'IXO431',
        cae: '86406602350114',
        ptoVta: 7,
        cbteNro: 9,
      }),
    );

    expect(html).toContain(
      '<title>00000009-0007_86406602350114_IXO431</title>',
    );
    expect(html).not.toContain('FACTURA A 00002-00000001');
  });

  it('agrega la hoja A4 sin márgenes del navegador, sólo al imprimir', () => {
    const html = printableInvoiceHtml(HTML, 'x');

    expect(html).toMatch(
      /<style media="print">[\s\S]*@page\{size:A4;margin:0\}[\s\S]*<\/style>\n<\/head>/,
    );
  });

  it('no deja meter HTML por el título', () => {
    expect(printableInvoiceHtml(HTML, '<b>"x"</b>')).toContain(
      '<title>bx/b</title>',
    );
  });
});
