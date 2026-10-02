import { describe, expect, it } from 'vitest';
import { summarizeSchedules } from './scheduleSummary';

describe('summarizeSchedules', () => {
  it('devuelve vacío sin horarios', () => {
    expect(summarizeSchedules([])).toEqual([]);
    expect(summarizeSchedules(null)).toEqual([]);
  });

  it('arma una línea por día, en orden de semana', () => {
    expect(
      summarizeSchedules([
        { day: 'friday', openMinute: 480, closeMinute: 1200 },
        { day: 'monday', openMinute: 480, closeMinute: 1200 },
      ]),
    ).toEqual(['Lun: 08:00–20:00', 'Vie: 08:00–20:00']);
  });

  it('junta las franjas de un día ordenadas', () => {
    expect(
      summarizeSchedules([
        { day: 'tuesday', openMinute: 840, closeMinute: 1200 },
        { day: 'tuesday', openMinute: 480, closeMinute: 720 },
      ]),
    ).toEqual(['Mar: 08:00–12:00, 14:00–20:00']);
  });

  it('muestra 24 hs y el cierre a medianoche', () => {
    expect(
      summarizeSchedules([
        { day: 'sunday', openMinute: 0, closeMinute: 1440 },
        { day: 'saturday', openMinute: 600, closeMinute: 1440 },
      ]),
    ).toEqual(['Sáb: 10:00–24:00', 'Dom: 24 hs']);
  });
});
