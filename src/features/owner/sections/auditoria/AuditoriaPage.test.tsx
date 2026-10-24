// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  click,
  field,
  change,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type { AuditEvent } from '../../services/audit';
import type { LprDetectionEvent } from '../../services/lpr-events';
import { AuditoriaPage } from './AuditoriaPage';

const services = vi.hoisted(() => ({
  listAuditEvents: vi.fn(),
  listCashSessions: vi.fn(),
  listLprDetectionEvents: vi.fn(),
  getLprDetectionEventImageUrl: vi.fn(),
}));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({ sucursalId: 'tenant', sucursal: { nombre: 'APEX' } }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user',
}));
vi.mock('../../services/audit', () => ({
  listAuditEvents: services.listAuditEvents,
  listCashSessions: services.listCashSessions,
}));
vi.mock('../../services/lpr-events', () => ({
  listLprDetectionEvents: services.listLprDetectionEvents,
  getLprDetectionEventImageUrl: services.getLprDetectionEventImageUrl,
}));

const NOW = '2026-10-07T15:00:00.000Z';

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: 'audit-1',
    action: 'entry.corrected',
    actorName: 'operador@parkit.test',
    createdAt: NOW,
    entityId: 'entry-1',
    entityType: 'entry',
    severity: 'warn',
    ...overrides,
  };
}

const EVENTS: AuditEvent[] = [
  event({
    id: 'corregido',
    metadata: {
      origin: 'history',
      actorRole: 'operator',
      reason: 'Error de tipeo',
      changedFields: ['plate', 'amountPaid'],
      before: { plate: 'ABC123', amountPaid: 3000, cashSessionId: 'caja-1' },
      after: { plate: 'XYZ999', amountPaid: 1000, cashSessionId: 'caja-1' },
      economicImpact: {
        chargedBefore: 3000,
        chargedAfter: 1000,
        chargedDelta: -2000,
        suggestedBefore: 3000,
        suggestedAfter: 3000,
        suggestedDelta: 0,
      },
    },
  }),
  event({
    id: 'cobro-bajo',
    action: 'entry.undercharged',
    severity: 'warn',
    metadata: {
      plate: 'DEF456',
      suggestedAmount: 2000,
      chargedAmount: 1500,
      delta: 500,
      cashSessionId: 'caja-1',
    },
  }),
  event({
    id: 'eliminado',
    action: 'entry.deleted',
    severity: 'crit',
    metadata: { plate: 'GHI789', amountPaid: 1200, ticketNumber: 12 },
  }),
  event({
    id: 'sin-factura',
    action: 'invoice.cert_expired',
    severity: 'warn',
    metadata: { plate: 'JKL012', chargedAmount: 900 },
  }),
];

function lprEvent(overrides: Partial<LprDetectionEvent>): LprDetectionEvent {
  return {
    id: 'lpr-1',
    cameraId: 'cam-1',
    candidates: [],
    confidence: 0.95,
    createdAt: NOW,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    formatType: 'argentina_mercosur',
    formatValid: true,
    location: 'Entrada',
    normalizedText: 'AB123CD',
    qualityStatus: 'valid_high',
    status: 'dismissed',
    reviewedAt: NOW,
    reviewedByName: 'Operador',
    syncSeq: 1,
    tenantId: 'tenant',
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

describe('AuditoriaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    services.listAuditEvents.mockResolvedValue(EVENTS);
    services.listCashSessions.mockResolvedValue([
      {
        id: 'caja-1',
        openedAt: NOW,
        openingCash: 0,
        tenantId: 'tenant',
        updatedAt: NOW,
        version: 1,
        syncSeq: 1,
      },
    ]);
    services.listLprDetectionEvents.mockResolvedValue({
      items: [
        lprEvent({ id: 'lpr-1' }),
        lprEvent({
          id: 'lpr-2',
          normalizedText: 'ZZ999ZZ',
          confidence: 0.4,
          qualityStatus: 'low_confidence',
        }),
      ],
      page: 1,
      pageSize: 100,
      total: 2,
    });
    services.getLprDetectionEventImageUrl.mockResolvedValue(null);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('resume el período en las cards y lista los eventos', async () => {
    await mount(<AuditoriaPage />);

    expect(pageText()).toContain('Auditoría');
    expect(pageText()).toContain('APEX · 4 eventos críticos o advertencias');
    expect(pageText()).toContain('Pérdida posible');
    expect(pageText()).toContain('XYZ999');
    expect(pageText()).toContain('DEF456');
    expect(services.listAuditEvents).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ limit: 5000 }),
    );
  });

  it('abre el detalle de una corrección con el antes y después', async () => {
    const { container } = await mount(<AuditoriaPage />);

    const row = [...container.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent?.includes('XYZ999'),
    )!;
    await click(row as HTMLElement);

    const drawer = document.body.textContent ?? '';
    expect(drawer).toContain('Detalle de auditoría');
    expect(drawer).toContain('Antes y después');
    expect(drawer).toContain('Error de tipeo');
  });

  it('abre el detalle de un cobro bajo el sugerido', async () => {
    const { container } = await mount(<AuditoriaPage />);

    const row = [...container.querySelectorAll('tbody tr')].find((tr) =>
      tr.textContent?.includes('DEF456'),
    )!;
    await click(row as HTMLElement);

    expect(pageText()).toContain('Impacto monetario');
  });

  it('una card filtra la tabla a su métrica', async () => {
    const { container } = await mount(<AuditoriaPage />);

    await click(/^Cobros bajo sugerido/);

    const rows = [...container.querySelectorAll('tbody tr')].map(
      (tr) => tr.textContent,
    );
    expect(rows.some((text) => text?.includes('DEF456'))).toBe(true);
    expect(rows.some((text) => text?.includes('XYZ999'))).toBe(false);
  });

  it('muestra las patentes descartadas en su pestaña', async () => {
    await mount(<AuditoriaPage />, { path: '/auditoria?tab=lpr' });

    expect(pageText()).toContain('AB123CD');
    expect(pageText()).toContain('ZZ999ZZ');
    expect(services.listLprDetectionEvents).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant', status: 'dismissed' }),
    );
  });

  it('busca entre las patentes descartadas', async () => {
    await mount(<AuditoriaPage />, { path: '/auditoria?tab=lpr' });

    const search = document.querySelector<HTMLInputElement>(
      '.audit-lpr-toolbar input, input[type="search"]',
    )!;
    await change(search, 'ZZ999');

    expect(pageText()).toContain('ZZ999ZZ');
    expect(pageText()).not.toContain('AB123CD');
  });

  it('"Descartes sospechosos" salta a la pestaña de patentes', async () => {
    await mount(<AuditoriaPage />);

    await click(/^Descartes sospechosos/);

    expect(pageText()).toContain('AB123CD');
    expect(pageText()).not.toContain('ZZ999ZZ');
  });

  it('avisa si no se pudo cargar la auditoría', async () => {
    services.listAuditEvents.mockRejectedValue(new Error('offline'));
    await mount(<AuditoriaPage />);

    expect(pageText()).toContain('No se pudo cargar la auditoría');
    await click('Reintentar');
    expect(services.listAuditEvents).toHaveBeenCalledTimes(2);
  });

  it('avisa si no hay descartes', async () => {
    services.listLprDetectionEvents.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    await mount(<AuditoriaPage />, { path: '/auditoria?tab=lpr' });

    expect(pageText()).toContain('Sin descartes LPR');
  });

  it('filtra la tabla a la caja abierta', async () => {
    await mount(<AuditoriaPage />);

    const toggle = field('Solo caja actual');
    await click(toggle);

    expect(pageText()).toContain('DEF456');
    expect(pageText()).not.toContain('GHI789');
  });
});
