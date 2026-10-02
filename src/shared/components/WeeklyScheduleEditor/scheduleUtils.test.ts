import { describe, expect, it } from 'vitest';
import {
  copyDayToAll,
  findScheduleIssues,
  minutesToTime,
  nextDefaultRange,
  setDay24h,
  setDayRanges,
  timeToMinutes,
  type ScheduleRange,
} from './scheduleUtils';

const r = (
  day: ScheduleRange['day'],
  openMinute: number,
  closeMinute: number,
): ScheduleRange => ({ day, openMinute, closeMinute });

describe('conversión minutos <-> HH:mm', () => {
  it('convierte ida y vuelta', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(480)).toBe('08:00');
    expect(minutesToTime(1439)).toBe('23:59');
    expect(timeToMinutes('08:30')).toBe(510);
  });
  it('el cierre a medianoche es 1440 y se muestra como 00:00', () => {
    expect(minutesToTime(1440)).toBe('00:00');
    expect(timeToMinutes('00:00', true)).toBe(1440);
    expect(timeToMinutes('00:00', false)).toBe(0);
  });
  it('texto vacío o inválido da null', () => {
    expect(timeToMinutes('')).toBeNull();
    expect(timeToMinutes('abc')).toBeNull();
  });
});

describe('findScheduleIssues', () => {
  it('sin problemas', () => {
    expect(
      findScheduleIssues([r('monday', 480, 1200), r('tuesday', 480, 1200)]),
    ).toEqual([]);
  });
  it('open >= close es inválido', () => {
    const issues = findScheduleIssues([
      r('monday', 600, 600),
      r('monday', 700, 600),
    ]);
    expect(issues.map((i) => [i.index, i.kind])).toEqual([
      [0, 'invalid_range'],
      [1, 'invalid_range'],
    ]);
    expect(issues[0].message).toBe(
      'La hora de cierre debe ser posterior a la de apertura.',
    );
  });
  it('detecta solape en el mismo día', () => {
    const issues = findScheduleIssues([
      r('monday', 480, 720),
      r('monday', 700, 900),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      index: 1,
      kind: 'overlap',
      overlapsWith: 0,
    });
  });
  it('franjas contiguas (08-12 y 12-20) NO se superponen', () => {
    expect(
      findScheduleIssues([r('monday', 480, 720), r('monday', 720, 1200)]),
    ).toEqual([]);
  });
  it('mismos horarios en días distintos no se superponen', () => {
    expect(
      findScheduleIssues([r('monday', 480, 720), r('tuesday', 480, 720)]),
    ).toEqual([]);
  });
  it('una franja inválida no cuenta para los solapes', () => {
    const issues = findScheduleIssues([
      r('monday', 900, 600),
      r('monday', 480, 1200),
    ]);
    expect(issues.map((i) => i.kind)).toEqual(['invalid_range']);
  });
});

describe('helpers de edición', () => {
  it('copyDayToAll copia las franjas del origen a todos los días', () => {
    const out = copyDayToAll(
      [r('monday', 480, 720), r('monday', 780, 1200)],
      'monday',
    );
    expect(out).toHaveLength(14);
    expect(out.filter((x) => x.day === 'sunday')).toEqual([
      r('sunday', 480, 720),
      r('sunday', 780, 1200),
    ]);
    expect(out[0].day).toBe('monday');
  });
  it('copyDayToAll con origen cerrado deja todo cerrado', () => {
    expect(copyDayToAll([r('tuesday', 480, 720)], 'monday')).toEqual([]);
  });
  it('setDay24h reemplaza el día por 0-1440', () => {
    const out = setDay24h([r('monday', 480, 720), r('friday', 1, 2)], 'monday');
    expect(out).toEqual([r('monday', 0, 1440), r('friday', 1, 2)]);
  });
  it('setDayRanges mantiene el orden de días', () => {
    const out = setDayRanges([r('friday', 1, 2)], 'monday', [
      { openMinute: 480, closeMinute: 720 },
    ]);
    expect(out.map((x) => x.day)).toEqual(['monday', 'friday']);
  });
  it('nextDefaultRange', () => {
    expect(nextDefaultRange([])).toEqual({
      openMinute: 480,
      closeMinute: 1200,
    });
    expect(nextDefaultRange([r('monday', 480, 720)])).toEqual({
      openMinute: 720,
      closeMinute: 780,
    });
  });
});
