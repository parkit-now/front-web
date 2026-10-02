import { useId, useMemo } from 'react';
import { IconAlert, IconPlus, IconTrash } from '../icons';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import {
  SCHEDULE_DAYS,
  closeDay,
  copyDayToAll,
  findScheduleIssues,
  is24h,
  minutesToTime,
  nextDefaultRange,
  setDay24h,
  timeToMinutes,
  DEFAULT_RANGE,
  type ScheduleDay,
  type ScheduleIssue,
  type ScheduleRange,
} from './scheduleUtils';

interface WeeklyScheduleEditorProps {
  value: ScheduleRange[];
  onChange: (next: ScheduleRange[]) => void;
  disabled?: boolean;
}

/**
 * Editor semanal de horarios, controlado. Una fila por día: switch
 * Abierto/Cerrado y una o más franjas desde/hasta. Un día está "abierto" si
 * tiene al menos una franja; quitar la última lo cierra.
 *
 * Cierre a medianoche: `<input type="time">` no admite "24:00", así que un
 * cierre "00:00" se interpreta como fin del día (1440). Los errores se
 * calculan con `findScheduleIssues`, igual que el backend.
 */
export function WeeklyScheduleEditor({
  value,
  onChange,
  disabled = false,
}: WeeklyScheduleEditorProps) {
  const uid = useId();
  const issues = useMemo(() => findScheduleIssues(value), [value]);
  const issueByIndex = useMemo(() => {
    const map = new Map<number, ScheduleIssue>();
    issues.forEach((i) => map.set(i.index, i));
    return map;
  }, [issues]);

  function toggleDay(day: ScheduleDay, open: boolean) {
    if (!open) return onChange(closeDay(value, day));
    onChange([...value, { day, ...DEFAULT_RANGE }]);
  }

  function addRange(day: ScheduleDay) {
    const existing = value.filter((r) => r.day === day);
    onChange([...value, { day, ...nextDefaultRange(existing) }]);
  }

  function updateRange(index: number, patch: Partial<ScheduleRange>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRange(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const monday = value.some((r) => r.day === 'monday');

  return (
    <div
      data-testid="weekly-schedule-editor"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {SCHEDULE_DAYS.map(({ id: day, label }) => {
        const dayRanges = value
          .map((range, index) => ({ range, index }))
          .filter(({ range }) => range.day === day);
        const open = dayRanges.length > 0;
        const rowId = `${uid}-${day}`;

        return (
          <section
            key={day}
            data-testid={`schedule-day-${day}`}
            className="pk-card pk-card-pad"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: 180,
                minHeight: 40,
              }}
            >
              <Switch
                checked={open}
                disabled={disabled}
                aria-label={`${label}: ${open ? 'abierto' : 'cerrado'}`}
                onChange={(checked) => toggleDay(day, checked)}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: 14, color: 'var(--text-1)' }}>
                  {label}
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {open ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 240,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {dayRanges.map(({ range, index }, n) => {
                const issue = issueByIndex.get(index);
                const errorId = `${rowId}-${n}-error`;
                const fromId = `${rowId}-${n}-from`;
                const toId = `${rowId}-${n}-to`;
                return (
                  <div
                    key={index}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <label htmlFor={fromId} style={srOnly}>
                        {label}, franja {n + 1}: desde
                      </label>
                      <input
                        id={fromId}
                        type="time"
                        className="pk-input"
                        style={{
                          width: 130,
                          borderColor: issue ? errorColor : undefined,
                        }}
                        value={minutesToTime(range.openMinute)}
                        disabled={disabled}
                        aria-invalid={issue ? true : undefined}
                        aria-describedby={issue ? errorId : undefined}
                        onChange={(e) => {
                          const m = timeToMinutes(e.target.value);
                          if (m !== null) updateRange(index, { openMinute: m });
                        }}
                      />
                      <span style={{ color: 'var(--text-3)' }}>a</span>
                      <label htmlFor={toId} style={srOnly}>
                        {label}, franja {n + 1}: hasta
                      </label>
                      <input
                        id={toId}
                        type="time"
                        className="pk-input"
                        style={{
                          width: 130,
                          borderColor: issue ? errorColor : undefined,
                        }}
                        value={minutesToTime(range.closeMinute)}
                        disabled={disabled}
                        aria-invalid={issue ? true : undefined}
                        aria-describedby={issue ? errorId : undefined}
                        onChange={(e) => {
                          const m = timeToMinutes(e.target.value, true);
                          if (m !== null)
                            updateRange(index, { closeMinute: m });
                        }}
                      />
                      {range.closeMinute === 1440 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {is24h(range) ? '24 hs' : 'hasta medianoche'}
                        </span>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        aria-label={`Quitar franja ${n + 1} del ${label.toLowerCase()}`}
                        onClick={() => removeRange(index)}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                    {issue ? (
                      <span
                        id={errorId}
                        role="alert"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          color: errorColor,
                        }}
                      >
                        <IconAlert size={13} /> {issue.message}
                      </span>
                    ) : null}
                  </div>
                );
              })}

              {open ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => addRange(day)}
                  >
                    <IconPlus size={14} /> Agregar franja
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange(setDay24h(value, day))}
                  >
                    Abierto 24 hs
                  </Button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 40,
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange(setDay24h(value, day))}
                  >
                    Abierto 24 hs
                  </Button>
                </div>
              )}
            </div>
          </section>
        );
      })}

      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !monday}
          onClick={() => onChange(copyDayToAll(value, 'monday'))}
        >
          Copiar lunes a todos los días
        </Button>
      </div>
    </div>
  );
}

const errorColor = 'var(--err-text, #b42318)';

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
