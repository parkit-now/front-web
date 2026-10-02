import {
  SCHEDULE_DAYS,
  minutesToTime,
  type ScheduleDay,
} from '../../../../shared/components/WeeklyScheduleEditor';

type DeclaredRange = { day: string; openMinute: number; closeMinute: number };

const DAY_ABBREVIATIONS: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

function describeRange(range: DeclaredRange): string {
  if (range.openMinute === 0 && range.closeMinute >= 1440) return '24 hs';
  // 1440 se muestra como 24:00 (el cierre a medianoche), no como "00:00".
  const close =
    range.closeMinute >= 1440 ? '24:00' : minutesToTime(range.closeMinute);
  return `${minutesToTime(range.openMinute)}–${close}`;
}

/**
 * Horarios declarados, una línea por día con franjas, en orden de semana
 * ("Lun: 08:00–20:00"). Vacío si no declaró ninguno: los días sin franjas no
 * se listan.
 */
export function summarizeSchedules(
  schedules: readonly DeclaredRange[] | null | undefined,
): string[] {
  if (!schedules || schedules.length === 0) return [];
  const lines: string[] = [];
  for (const { id } of SCHEDULE_DAYS) {
    const ranges = schedules
      .filter((r) => r.day === id)
      .sort((a, b) => a.openMinute - b.openMinute);
    if (ranges.length === 0) continue;
    lines.push(
      `${DAY_ABBREVIATIONS[id]}: ${ranges.map(describeRange).join(', ')}`,
    );
  }
  return lines;
}
