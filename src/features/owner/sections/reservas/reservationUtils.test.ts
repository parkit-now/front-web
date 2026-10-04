import { describe, expect, it } from 'vitest';
import type { OwnerReservation } from '../../services/reservations';
import {
  availableActions,
  countByTab,
  countdownTo,
  explainRefundFailure,
  failedRefunds,
  paidAmountArs,
  policyLines,
  formatSlot,
  reasonLabel,
  refundChip,
  statusChip,
  tabOf,
} from './reservationUtils';

const NOW = Date.parse('2026-10-03T16:00:00Z');

function res(patch: Partial<OwnerReservation> = {}): OwnerReservation {
  return {
    id: 'r1',
    code: 'R-4F2K9A',
    status: 'confirmed',
    vehiclePlate: 'AB123CD',
    vehicleCategory: 'car',
    driverName: 'Lucía M.',
    entryAt: '2026-10-03T21:00:00Z',
    exitAt: '2026-10-04T00:00:00Z',
    totalArs: 4500,
    rateName: 'Hora',
    createdAt: '2026-10-03T15:00:00Z',
    holdExpiresAt: null,
    paidAt: '2026-10-03T15:05:00Z',
    approvalDeadlineAt: null,
    cancelledAt: null,
    cancelledBy: null,
    reason: null,
    refundStatus: 'none',
    refundedAmountArs: null,
    refundError: null,
    policy: {
      freeCancelMinutes: 60,
      lateCancelRefundPct: 0,
      earlyArrivalMinutes: 15,
      graceMinutes: 30,
      acceptanceMode: 'auto',
      approvalWindowMinutes: 15,
      earlyArrivalMaxMinutes: 60,
    },
    stay: null,
    ...patch,
  };
}

describe('tabOf', () => {
  it('manda cada estado a su pestaña', () => {
    expect(tabOf({ status: 'pending_approval' })).toBe('pending');
    expect(tabOf({ status: 'confirmed' })).toBe('upcoming');
    expect(tabOf({ status: 'checked_in' })).toBe('inProgress');
    for (const status of [
      'completed',
      'cancelled',
      'rejected',
      'no_show',
    ] as const) {
      expect(tabOf({ status })).toBe('history');
    }
  });

  it('esconde las reservas que nunca se pagaron', () => {
    expect(tabOf({ status: 'pending_payment' })).toBeNull();
    expect(tabOf({ status: 'expired' })).toBeNull();
  });

  it('cuenta por pestaña', () => {
    const counts = countByTab([
      { status: 'pending_approval' },
      { status: 'pending_approval' },
      { status: 'confirmed' },
      { status: 'expired' },
      { status: 'completed' },
    ]);
    expect(counts).toEqual({
      pending: 2,
      upcoming: 1,
      inProgress: 0,
      history: 1,
    });
  });
});

describe('statusChip', () => {
  it('distingue quién canceló', () => {
    expect(
      statusChip(res({ status: 'cancelled', cancelledBy: 'owner' })).label,
    ).toBe('Cancelada · vos');
    expect(
      statusChip(res({ status: 'cancelled', cancelledBy: 'driver' })).label,
    ).toBe('Cancelada · conductor');
    expect(
      statusChip(res({ status: 'cancelled', cancelledBy: 'system' })).label,
    ).toBe('Cancelada · sistema');
  });

  it('distingue rechazo del dueño de vencimiento del plazo', () => {
    expect(
      statusChip(res({ status: 'rejected', cancelledBy: 'owner' })).label,
    ).toBe('Rechazada');
    expect(
      statusChip(res({ status: 'rejected', cancelledBy: 'system' })).label,
    ).toBe('Vencida sin respuesta');
  });

  it('nombra los estados vivos', () => {
    expect(statusChip(res({ status: 'pending_approval' })).label).toBe(
      'Por aceptar',
    );
    expect(statusChip(res({ status: 'confirmed' })).label).toBe('Confirmada');
    expect(statusChip(res({ status: 'checked_in' })).label).toBe('En curso');
    expect(statusChip(res({ status: 'no_show' })).label).toBe('No se presentó');
  });
});

describe('refundChip', () => {
  it('mapea el estado del reembolso', () => {
    expect(refundChip(res({ refundStatus: 'refunded' }))?.label).toBe(
      'Reembolsada',
    );
    expect(refundChip(res({ refundStatus: 'pending' }))?.label).toBe(
      'Reembolso en curso',
    );
    expect(refundChip(res({ refundStatus: 'failed' }))).toEqual({
      label: 'Reembolso fallido',
      variant: 'err',
    });
    expect(refundChip(res({ refundStatus: 'partial' }))?.label).toBe(
      'Reembolso parcial',
    );
  });

  it('sin reembolso solo cuando la política lo permite', () => {
    expect(refundChip(res({ status: 'no_show' }))?.label).toBe('Sin reembolso');
    expect(
      refundChip(res({ status: 'cancelled', cancelledBy: 'driver' }))?.label,
    ).toBe('Sin reembolso');
    expect(refundChip(res({ status: 'confirmed' }))).toBeNull();
  });
});

describe('availableActions', () => {
  it('por aceptar: aceptar y rechazar', () => {
    const r = res({
      status: 'pending_approval',
      approvalDeadlineAt: new Date(NOW + 60_000).toISOString(),
    });
    expect(availableActions(r, NOW)).toEqual(['accept', 'reject']);
  });

  it('por aceptar vencida: ya no se puede aceptar', () => {
    const r = res({
      status: 'pending_approval',
      approvalDeadlineAt: new Date(NOW - 1000).toISOString(),
    });
    expect(availableActions(r, NOW)).toEqual(['reject']);
  });

  it('confirmada: cancelar y reembolsar', () => {
    expect(availableActions(res({ status: 'confirmed' }), NOW)).toEqual([
      'cancel',
    ]);
  });

  it('en curso y terminadas: sin acciones', () => {
    for (const status of [
      'checked_in',
      'completed',
      'rejected',
      'no_show',
      'cancelled',
    ] as const) {
      expect(availableActions(res({ status }), NOW)).toEqual([]);
    }
  });

  it('reembolso fallido suma reintentar en cualquier estado', () => {
    expect(
      availableActions(
        res({ status: 'cancelled', refundStatus: 'failed' }),
        NOW,
      ),
    ).toEqual(['retryRefund']);
    expect(
      availableActions(
        res({ status: 'confirmed', refundStatus: 'failed' }),
        NOW,
      ),
    ).toEqual(['cancel', 'retryRefund']);
  });
});

describe('countdownTo', () => {
  it('formatea mm:ss', () => {
    const c = countdownTo(
      new Date(NOW + (14 * 60 + 12) * 1000).toISOString(),
      NOW,
    );
    expect(c).toMatchObject({ label: '14:12', expired: false, urgent: false });
  });

  it('marca urgente bajo los 3 minutos', () => {
    const c = countdownTo(new Date(NOW + 179_000).toISOString(), NOW);
    expect(c?.urgent).toBe(true);
    expect(c?.label).toBe('02:59');
  });

  it('redondea hacia arriba: nunca muestra 00:00 antes de vencer', () => {
    expect(countdownTo(new Date(NOW + 400).toISOString(), NOW)?.label).toBe(
      '00:01',
    );
  });

  it('vencido', () => {
    expect(countdownTo(new Date(NOW).toISOString(), NOW)).toEqual({
      label: '00:00',
      remainingMs: 0,
      expired: true,
      urgent: true,
    });
  });

  it('sin plazo, null; con más de una hora, h:mm:ss', () => {
    expect(countdownTo(null, NOW)).toBeNull();
    expect(
      countdownTo(new Date(NOW + 3_723_000).toISOString(), NOW)?.label,
    ).toBe('1:02:03');
  });
});

describe('formatSlot', () => {
  const now = new Date('2026-10-03T16:00:00Z'); // 13:00 en Argentina

  it('hoy', () => {
    expect(
      formatSlot('2026-10-03T21:00:00Z', '2026-10-04T00:00:00Z', now),
    ).toBe('Hoy 18:00–21:00');
  });

  it('mañana y otra fecha', () => {
    expect(
      formatSlot('2026-10-04T12:00:00Z', '2026-10-04T15:00:00Z', now),
    ).toBe('Mañana 09:00–12:00');
    expect(
      formatSlot('2026-10-09T12:00:00Z', '2026-10-09T15:00:00Z', now),
    ).toBe('09/10 09:00–12:00');
  });

  it('cruza la medianoche', () => {
    expect(
      formatSlot('2026-10-04T01:00:00Z', '2026-10-04T07:00:00Z', now),
    ).toBe('Hoy 22:00 – Mañana 04:00');
  });
});

describe('reembolso fallido', () => {
  it('cuenta los fallidos', () => {
    expect(
      failedRefunds([
        { refundStatus: 'failed' },
        { refundStatus: 'refunded' },
        { refundStatus: 'failed' },
      ]),
    ).toBe(2);
  });

  it('explica la falta de saldo con el monto', () => {
    const e = explainRefundFailure('insufficient_amount in account', 4500);
    expect(e.title).toContain('no tiene saldo suficiente');
    expect(e.title).toContain('4.500');
    expect(e.action).toBe('Cargá saldo y reintentá.');
  });

  it('explica el token vencido', () => {
    expect(explainRefundFailure('401 unauthorized').action).toContain(
      'Integraciones',
    );
  });

  it('nunca muestra el texto crudo', () => {
    const e = explainRefundFailure('Dev checkout: reembolso forzado a fallar');
    expect(e.title).not.toContain('Dev checkout');
    expect(e.action).toContain('reintentá');
  });
});

describe('reasonLabel', () => {
  it('traduce los códigos del sistema y respeta el texto libre', () => {
    expect(reasonLabel({ reason: 'approval_timeout' })).toBe(
      'No respondiste a tiempo',
    );
    expect(reasonLabel({ reason: 'Corte de luz' })).toBe('Corte de luz');
    expect(reasonLabel({ reason: null })).toBeNull();
  });
});

describe('paidAmountArs y policyLines', () => {
  it('toma el cobro aprobado, aunque después se haya reembolsado', () => {
    expect(
      paidAmountArs([
        { status: 'rejected', amountArs: 100 },
        { status: 'refunded', amountArs: 4500 },
      ]),
    ).toBe(4500);
    expect(paidAmountArs([{ status: 'created', amountArs: 4500 }])).toBeNull();
  });

  it('resume la política de la reserva', () => {
    const lines = policyLines(res().policy);
    expect(lines[0]).toContain('gratis hasta 60 min');
    expect(lines[0]).toContain('no se le devuelve nada');
    expect(lines[2]).toBe('Aceptación automática.');
    const manual = policyLines({
      ...res().policy,
      acceptanceMode: 'manual',
      lateCancelRefundPct: 50,
    });
    expect(manual[0]).toContain('el 50 %');
    expect(manual[2]).toContain('15 min para responder');
  });
});
