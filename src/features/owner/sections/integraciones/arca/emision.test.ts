import { describe, expect, it } from 'vitest';
import type { PaymentMethodSummary } from '../../../services/entities';
import {
  buildInvoiceModeDraft,
  describeInvoiceEffect,
  didIvaRateChange,
  diffInvoiceModes,
} from './emision';

function makeMethod(
  overrides: Partial<PaymentMethodSummary> = {},
): PaymentMethodSummary {
  return {
    id: '1',
    name: 'Efectivo',
    type: 'cash',
    enabled: true,
    isDefault: true,
    isSystem: true,
    invoiceMode: 'none',
    syncSeq: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildInvoiceModeDraft', () => {
  it('arma un borrador con el invoiceMode de cada medio', () => {
    const methods = [
      makeMethod({ id: 'a', invoiceMode: 'none' }),
      makeMethod({ id: 'b', invoiceMode: 'auto' }),
    ];
    expect(buildInvoiceModeDraft(methods)).toEqual({ a: 'none', b: 'auto' });
  });
});

describe('diffInvoiceModes', () => {
  it('no reporta nada si el borrador es igual al original', () => {
    const methods = [makeMethod({ id: 'a', invoiceMode: 'none' })];
    const draft = buildInvoiceModeDraft(methods);
    expect(diffInvoiceModes(methods, draft)).toEqual([]);
  });

  it('reporta sólo los medios que cambiaron', () => {
    const methods = [
      makeMethod({ id: 'a', invoiceMode: 'none' }),
      makeMethod({ id: 'b', invoiceMode: 'none' }),
    ];
    const draft = { a: 'auto' as const, b: 'none' as const };
    expect(diffInvoiceModes(methods, draft)).toEqual([
      { id: 'a', invoiceMode: 'auto' },
    ]);
  });
});

describe('didIvaRateChange', () => {
  it('detecta un cambio numérico', () => {
    expect(didIvaRateChange(21, '10.5')).toBe(true);
  });

  it('no marca cambio si queda igual', () => {
    expect(didIvaRateChange(21, '21')).toBe(false);
  });

  it('ignora un valor vacío o no numérico', () => {
    expect(didIvaRateChange(21, '')).toBe(false);
    expect(didIvaRateChange(21, 'abc')).toBe(false);
  });
});

describe('describeInvoiceEffect', () => {
  it('describe los tres modos', () => {
    expect(describeInvoiceEffect('none')).toContain('No se factura');
    expect(describeInvoiceEffect('auto')).toContain('al confirmar el pago');
    expect(describeInvoiceEffect('manual')).toContain('Historial');
  });
});
