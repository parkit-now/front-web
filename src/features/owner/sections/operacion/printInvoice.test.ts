import { describe, expect, it } from 'vitest';
import { printableInvoiceHtml } from './printInvoice';

const HTML =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FACTURA A 00002-00000001</title><style></style></head><body></body></html>';

describe('printableInvoiceHtml', () => {
  it('usa el nombre del archivo como título (lo que propone «Guardar como PDF»)', () => {
    const html = printableInvoiceHtml(
      HTML,
      'ARC004-86390928531370-0002-00000001',
    );

    expect(html).toContain(
      '<title>ARC004-86390928531370-0002-00000001</title>',
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
