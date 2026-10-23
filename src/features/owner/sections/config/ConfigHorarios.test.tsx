// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  change,
  click,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type { Schedule } from '../../services/schedules';
import { ConfigHorarios } from './ConfigHorarios';

const api = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
}));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../services/schedules', () => api);

const NOW = '2026-10-07T15:00:00.000Z';

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'lunes',
    day: 'monday',
    openMinute: 480,
    closeMinute: 1200,
    createdAt: NOW,
    updatedAt: NOW,
    tenantId: 'tenant',
    version: 2,
    syncSeq: 1,
    ...overrides,
  };
}

/** Tarjeta del día (Lunes, Martes...). */
function day(label: string): HTMLElement {
  return [...document.querySelectorAll('section')].find(
    (section) => section.querySelector('h3')?.textContent === label,
  )!;
}

function times(host: ParentNode) {
  return [...host.querySelectorAll<HTMLInputElement>('input[type="time"]')];
}

describe('ConfigHorarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sucursal.role = 'owner';
    api.listSchedules.mockResolvedValue([
      schedule(),
      schedule({ id: 'martes', day: 'tuesday', closeMinute: 1440 }),
    ]);
    api.createSchedule.mockResolvedValue(schedule({ id: 'nuevo' }));
    api.updateSchedule.mockResolvedValue(schedule());
    api.deleteSchedule.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('muestra los tramos de cada día y los días cerrados', async () => {
    await mount(<ConfigHorarios />);

    expect(pageText()).toContain('Horarios de atención');
    expect(times(day('Lunes')).map((input) => input.value)).toEqual([
      '08:00',
      '20:00',
    ]);
    expect(times(day('Martes'))[1].value).toBe('00:00');
    expect(day('Miércoles').textContent).toContain('Cerrado');
  });

  it('guarda un tramo editado', async () => {
    await mount(<ConfigHorarios />);

    await change(times(day('Lunes'))[1], '22:00');
    await click('Guardar', day('Lunes'));

    expect(api.updateSchedule).toHaveBeenCalledWith('tenant', 'lunes', 2, {
      openMinute: 480,
      closeMinute: 1320,
    });
  });

  it('rechaza un cierre anterior a la apertura', async () => {
    await mount(<ConfigHorarios />);

    await change(times(day('Lunes'))[1], '07:00');
    await click('Guardar', day('Lunes'));

    expect(api.updateSchedule).not.toHaveBeenCalled();
    expect(pageText()).toContain(
      'La hora de cierre debe ser posterior a la de apertura.',
    );
  });

  it('agrega un tramo nuevo y rechaza uno superpuesto', async () => {
    await mount(<ConfigHorarios />);

    await click('+ Agregar horario', day('Lunes'));
    await click('Agregar', day('Lunes'));
    expect(pageText()).toContain('Los horarios no pueden superponerse.');

    const [open, close] = times(day('Lunes')).slice(2);
    await change(open, '21:00');
    await change(close, '23:00');
    await click('Agregar', day('Lunes'));

    expect(api.createSchedule).toHaveBeenCalledWith('tenant', {
      day: 'monday',
      openMinute: 1260,
      closeMinute: 1380,
    });
  });

  it('descarta un tramo nuevo sin guardar', async () => {
    await mount(<ConfigHorarios />);

    await click('+ Agregar horario', day('Domingo'));
    await click('Cancelar', day('Domingo'));

    expect(day('Domingo').textContent).toContain('Cerrado');
  });

  it('elimina un tramo y avisa si falla', async () => {
    api.deleteSchedule.mockRejectedValue(new ApiError(500, 'boom', null));
    await mount(<ConfigHorarios />);

    await click('Eliminar', day('Martes'));

    expect(api.deleteSchedule).toHaveBeenCalledWith('tenant', 'martes', 2);
    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('sin permisos de dueño queda en solo lectura', async () => {
    sucursal.role = 'operator';
    await mount(<ConfigHorarios />);

    expect(times(day('Lunes'))[0].disabled).toBe(true);
    expect(pageText()).not.toContain('+ Agregar horario');
  });
});
