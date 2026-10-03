import { describe, expect, it } from 'vitest';
import type { Rate } from '../../services/rates';
import type { ReservationHours, ServiceItem } from '../../services/services';
import {
  buildChecklist,
  buildHoursPut,
  buildPricePreview,
  buildServicePatch,
  hoursChanged,
  isDirty,
  needsAttention,
  planSaveSteps,
  readMissingFromProblem,
  toReservationForm,
  unreservedSpotsText,
} from './reservationSetup';

const service: ServiceItem = {
  code: 'ADVANCE_RESERVATION',
  enabled: false,
  reservableSpots: 8,
  reservationRateId: 'rate-1',
  reservationVehicleKinds: ['car', 'suv_pickup'],
  reservationHoursMode: 'opening',
  acceptanceMode: 'auto',
  approvalWindowMinutes: 15,
  freeCancelMinutes: 60,
  lateCancelRefundPct: 0,
  earlyArrivalMinutes: 15,
  graceMinutes: 30,
  readiness: { ready: true, missing: [] },
  upcomingPaidReservations: 0,
};
const hours: ReservationHours = { mode: 'opening', ranges: [] };

const rate = {
  id: 'rate-1',
  name: 'Por hora',
  hourPriceArs: 1500,
  fractionPriceArs: 125,
  mediaEstadiaPriceArs: 0,
  stayPriceArs: 0,
} as Rate;

describe('toReservationForm / isDirty', () => {
  it('copia el DTO y no está sucio', () => {
    const form = toReservationForm(service, hours);
    expect(form.reservableSpots).toBe('8');
    expect(isDirty(form, toReservationForm(service, hours))).toBe(false);
  });

  it('las plazas sin configurar quedan vacías', () => {
    const form = toReservationForm(
      { ...service, reservableSpots: null },
      hours,
    );
    expect(form.reservableSpots).toBe('');
  });

  it('el orden de los vehículos no ensucia', () => {
    const initial = toReservationForm(service, hours);
    expect(isDirty({ ...initial, kinds: ['suv_pickup', 'car'] }, initial)).toBe(
      false,
    );
    expect(isDirty({ ...initial, kinds: ['car'] }, initial)).toBe(true);
  });

  it('en modo opening los rangos no cuentan', () => {
    const initial = toReservationForm(service, hours);
    const edited = {
      ...initial,
      ranges: [{ day: 'monday' as const, openMinute: 480, closeMinute: 600 }],
    };
    expect(isDirty(edited, initial)).toBe(false);
    expect(hoursChanged(edited, initial)).toBe(false);
    expect(hoursChanged({ ...edited, hoursMode: 'custom' }, initial)).toBe(
      true,
    );
  });
});

describe('buildServicePatch', () => {
  const initial = toReservationForm(service, hours);

  it('sin cambios, el patch es vacío', () => {
    expect(buildServicePatch(initial, initial)).toEqual({ patch: {} });
  });

  it('manda sólo lo que cambió', () => {
    const result = buildServicePatch(
      {
        ...initial,
        reservableSpots: '10',
        kinds: ['car'],
        rateId: '',
        acceptanceMode: 'manual',
        lateCancelRefundPct: '50',
      },
      initial,
    );
    expect(result).toEqual({
      patch: {
        reservableSpots: 10,
        reservationVehicleKinds: ['car'],
        reservationRateId: null,
        acceptanceMode: 'manual',
        lateCancelRefundPct: 50,
      },
    });
  });

  it('vaciar las plazas manda null', () => {
    expect(
      buildServicePatch({ ...initial, reservableSpots: '' }, initial),
    ).toEqual({ patch: { reservableSpots: null } });
  });

  it('valida los rangos de cada campo', () => {
    const result = buildServicePatch(
      {
        ...initial,
        reservableSpots: '-1',
        approvalWindowMinutes: '3',
        freeCancelMinutes: '1441',
        earlyArrivalMinutes: '',
        graceMinutes: '1.5',
      },
      initial,
    );
    expect(result).toHaveProperty('errors');
    const errors = (result as { errors: Record<string, string> }).errors;
    expect(Object.keys(errors).sort()).toEqual([
      'approvalWindowMinutes',
      'earlyArrivalMinutes',
      'freeCancelMinutes',
      'graceMinutes',
      'reservableSpots',
    ]);
  });
});

describe('buildHoursPut', () => {
  it('opening manda rangos vacíos', () => {
    const form = {
      ...toReservationForm(service, hours),
      ranges: [{ day: 'monday' as const, openMinute: 1, closeMinute: 2 }],
    };
    expect(buildHoursPut(form)).toEqual({ mode: 'opening', ranges: [] });
  });

  it('custom manda los rangos ordenados por día', () => {
    const form = {
      ...toReservationForm(service, hours),
      hoursMode: 'custom' as const,
      ranges: [
        { day: 'saturday' as const, openMinute: 540, closeMinute: 780 },
        { day: 'monday' as const, openMinute: 480, closeMinute: 1200 },
      ],
    };
    expect(buildHoursPut(form).ranges.map((r) => r.day)).toEqual([
      'monday',
      'saturday',
    ]);
  });
});

describe('buildChecklist', () => {
  it('devuelve los 5 requisitos en orden y marca lo que falta', () => {
    const items = buildChecklist(['mp_account', 'hours'], ['hours'], true);
    expect(items.map((i) => i.key)).toEqual([
      'mp_account',
      'spots',
      'hours',
      'vehicles',
      'rate',
    ]);
    expect(items.map((i) => i.ok)).toEqual([false, true, false, true, true]);
    expect(items.find((i) => i.key === 'hours')?.failed).toBe(true);
    expect(items.find((i) => i.key === 'mp_account')?.failed).toBe(false);
  });

  it('mp_account lleva a Integraciones y rate sin tarifas a Tarifas', () => {
    const items = buildChecklist(['mp_account', 'rate'], [], false);
    expect(items[0].target).toEqual({ kind: 'route', to: '../integraciones' });
    expect(items[4].target).toEqual({ kind: 'route', to: '../tasas' });
  });

  it('un requisito cumplido nunca figura como fallido', () => {
    expect(buildChecklist([], ['spots'], true).some((i) => i.failed)).toBe(
      false,
    );
  });
});

describe('buildChecklist con markAllMissingFailed', () => {
  it('marca como fallidos todos los requisitos faltantes', () => {
    const items = buildChecklist(['mp_account', 'rate'], [], true, true);
    expect(items.map((i) => i.failed)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });
});

describe('needsAttention', () => {
  it('solo cuando está activa y no cumple los requisitos', () => {
    expect(needsAttention(true, false)).toBe(true);
    expect(needsAttention(true, true)).toBe(false);
    expect(needsAttention(false, false)).toBe(false);
    expect(needsAttention(false, true)).toBe(false);
  });
});

describe('planSaveSteps', () => {
  it('manda los horarios antes que la configuración', () => {
    expect(planSaveSteps({ hasPatch: true, hasHours: true })).toEqual([
      'hours',
      'config',
    ]);
  });
  it('omite lo que no cambió', () => {
    expect(planSaveSteps({ hasPatch: true, hasHours: false })).toEqual([
      'config',
    ]);
    expect(planSaveSteps({ hasPatch: false, hasHours: true })).toEqual([
      'hours',
    ]);
    expect(planSaveSteps({ hasPatch: false, hasHours: false })).toEqual([]);
  });
});

describe('readMissingFromProblem', () => {
  it('lee missing y descarta valores desconocidos', () => {
    expect(
      readMissingFromProblem({ missing: ['spots', 'foo', 'rate'] }),
    ).toEqual(['spots', 'rate']);
  });
  it('tolera cualquier otra forma', () => {
    expect(readMissingFromProblem(null)).toEqual([]);
    expect(readMissingFromProblem({ missing: 'x' })).toEqual([]);
  });
});

describe('buildPricePreview', () => {
  it('calcula 1 h, 1 h 30 y 3 h con calcStayPrice', () => {
    // Hora completa + 6 fracciones de 5 min (min 61-90) + 24 (min 61-180).
    expect(buildPricePreview(rate)).toEqual([
      { label: '1 h', minutes: 60, price: 1500 },
      { label: '1 h 30', minutes: 90, price: 1500 + 6 * 125 },
      { label: '3 h', minutes: 180, price: 1500 + 1500 + 1500 },
    ]);
  });
  it('sin tarifa no hay vista previa', () => {
    expect(buildPricePreview(undefined)).toEqual([]);
  });
});

describe('unreservedSpotsText', () => {
  it('cuenta las plazas que quedan', () => {
    expect(unreservedSpotsText(40, '8')).toBe(
      'Las otras 32 siguen para quien llega sin reserva.',
    );
    expect(unreservedSpotsText(40, '39')).toBe(
      'La otra sigue para quien llega sin reserva.',
    );
    expect(unreservedSpotsText(40, '40')).toBe(
      'No queda ninguna plaza para quien llega sin reserva.',
    );
  });
  it('null si no es válido o excede la capacidad', () => {
    expect(unreservedSpotsText(40, '41')).toBeNull();
    expect(unreservedSpotsText(40, 'x')).toBeNull();
    expect(unreservedSpotsText(undefined, '8')).toBeNull();
  });
});
