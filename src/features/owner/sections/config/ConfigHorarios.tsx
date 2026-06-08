import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../shared/components/ui/Button';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  updateSchedule,
  type Schedule,
  type ScheduleDay,
} from '../../services/schedules';

const DAYS: { id: ScheduleDay; label: string }[] = [
  { id: 'monday', label: 'Lunes' },
  { id: 'tuesday', label: 'Martes' },
  { id: 'wednesday', label: 'Miércoles' },
  { id: 'thursday', label: 'Jueves' },
  { id: 'friday', label: 'Viernes' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
];

const EMPTY_DRAFT = { open: '08:00', close: '20:00' };

/** Minutes since midnight -> "HH:mm". 1440 (midnight end-of-day) -> "00:00". */
function minutesToTime(mins: number): string {
  const value = mins >= 1440 ? 0 : mins;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:mm" -> minutes. A closing "00:00" means midnight (1440), not 0. */
function timeToMinutes(value: string, isClose = false): number {
  const [h, m] = value.split(':').map(Number);
  const mins = (h || 0) * 60 + (m || 0);
  return isClose && mins === 0 ? 1440 : mins;
}

export function ConfigHorarios() {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canEdit = sucursal?.role === 'owner';

  const queryKey = ['schedules', sucursalId];
  const { data: schedules = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listSchedules(sucursalId),
    enabled: Boolean(sucursalId),
  });

  // Editable copy of each persisted range, keyed by schedule id.
  const [edits, setEdits] = useState<
    Record<string, { open: string; close: string }>
  >({});
  // Pending new range per day.
  const [drafts, setDrafts] = useState<
    Partial<Record<ScheduleDay, { open: string; close: string }>>
  >({});

  useEffect(() => {
    setEdits(
      Object.fromEntries(
        schedules.map((s) => [
          s.id,
          {
            open: minutesToTime(s.openMinute),
            close: minutesToTime(s.closeMinute),
          },
        ]),
      ),
    );
  }, [schedules]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey });
  }

  const createMutation = useMutation({
    mutationFn: (vars: { day: ScheduleDay; open: number; close: number }) =>
      createSchedule(sucursalId, {
        day: vars.day,
        openMinute: vars.open,
        closeMinute: vars.close,
      }),
    onSuccess: (_data, vars) => {
      setDrafts((d) => ({ ...d, [vars.day]: undefined }));
      invalidate();
    },
    onError: (error) =>
      showToast({
        message: translateApiError(error, { endpoint: 'schedules.create' }),
        kind: 'error',
      }),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      version: number;
      open: number;
      close: number;
    }) =>
      updateSchedule(sucursalId, vars.id, vars.version, {
        openMinute: vars.open,
        closeMinute: vars.close,
      }),
    onSuccess: invalidate,
    onError: (error) =>
      showToast({
        message: translateApiError(error, { endpoint: 'schedules.update' }),
        kind: 'error',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string; version: number }) =>
      deleteSchedule(sucursalId, vars.id, vars.version),
    onSuccess: invalidate,
    onError: (error) =>
      showToast({
        message: translateApiError(error, { endpoint: 'schedules.delete' }),
        kind: 'error',
      }),
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  /** Local guard mirroring the backend rule; the server is the authority. */
  function validate(
    day: ScheduleDay,
    open: number,
    close: number,
    excludeId?: string,
  ): boolean {
    if (close <= open) {
      showToast({
        message: 'La hora de cierre debe ser posterior a la de apertura.',
        kind: 'error',
      });
      return false;
    }
    const overlaps = schedules.some(
      (s) =>
        s.day === day &&
        s.id !== excludeId &&
        open < s.closeMinute &&
        close > s.openMinute,
    );
    if (overlaps) {
      showToast({
        message: 'Los horarios no pueden superponerse.',
        kind: 'error',
      });
      return false;
    }
    return true;
  }

  function handleSaveEdit(s: Schedule) {
    const edit = edits[s.id];
    if (!edit) return;
    const open = timeToMinutes(edit.open);
    const close = timeToMinutes(edit.close, true);
    if (!validate(s.day, open, close, s.id)) return;
    updateMutation.mutate({ id: s.id, version: s.version, open, close });
  }

  function handleAddDraft(day: ScheduleDay) {
    const draft = drafts[day] ?? EMPTY_DRAFT;
    const open = timeToMinutes(draft.open);
    const close = timeToMinutes(draft.close, true);
    if (!validate(day, open, close)) return;
    createMutation.mutate({ day, open, close });
  }

  function isDirty(s: Schedule): boolean {
    const edit = edits[s.id];
    return (
      !!edit &&
      (timeToMinutes(edit.open) !== s.openMinute ||
        timeToMinutes(edit.close, true) !== s.closeMinute)
    );
  }

  if (isLoading) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
        Cargando horarios...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Horarios de atención
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          Definí los horarios de cada día. Podés cargar varios tramos por día
          (no pueden superponerse).
        </p>
      </div>

      {DAYS.map(({ id: day, label }) => {
        const ranges = schedules
          .filter((s) => s.day === day)
          .sort((a, b) => a.openMinute - b.openMinute);
        const draft = drafts[day];

        return (
          <section
            key={day}
            className="pk-card pk-card-pad"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-1)',
              }}
            >
              {label}
            </h3>

            {ranges.length === 0 && !draft && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
                Cerrado
              </p>
            )}

            {ranges.map((s) => {
              const edit = edits[s.id] ?? {
                open: minutesToTime(s.openMinute),
                close: minutesToTime(s.closeMinute),
              };
              return (
                <div
                  key={s.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <input
                    type="time"
                    className="pk-input"
                    style={{ width: 130 }}
                    value={edit.open}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setEdits((m) => ({
                        ...m,
                        [s.id]: { ...edit, open: e.target.value },
                      }))
                    }
                  />
                  <span style={{ color: 'var(--text-3)' }}>a</span>
                  <input
                    type="time"
                    className="pk-input"
                    style={{ width: 130 }}
                    value={edit.close}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setEdits((m) => ({
                        ...m,
                        [s.id]: { ...edit, close: e.target.value },
                      }))
                    }
                  />
                  {canEdit && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSaveEdit(s)}
                        disabled={!isDirty(s) || isPending}
                      >
                        Guardar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          deleteMutation.mutate({
                            id: s.id,
                            version: s.version,
                          })
                        }
                        disabled={isPending}
                      >
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              );
            })}

            {draft && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="time"
                  className="pk-input"
                  style={{ width: 130 }}
                  value={draft.open}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [day]: { ...draft, open: e.target.value },
                    }))
                  }
                />
                <span style={{ color: 'var(--text-3)' }}>a</span>
                <input
                  type="time"
                  className="pk-input"
                  style={{ width: 130 }}
                  value={draft.close}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [day]: { ...draft, close: e.target.value },
                    }))
                  }
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAddDraft(day)}
                  disabled={isPending}
                >
                  Agregar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDrafts((d) => ({ ...d, [day]: undefined }))}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {canEdit && !draft && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDrafts((d) => ({ ...d, [day]: { ...EMPTY_DRAFT } }))
                  }
                  disabled={isPending}
                >
                  + Agregar horario
                </Button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
