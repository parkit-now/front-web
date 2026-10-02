import { Input } from '../../../shared/components/ui/Input';
import {
  WeeklyScheduleEditor,
  type ScheduleRange,
} from '../../../shared/components/WeeklyScheduleEditor';

type Props = {
  totalSpots: string;
  totalSpotsError?: string;
  schedules: ScheduleRange[];
  disabled: boolean;
  onTotalSpotsChange: (value: string) => void;
  onSchedulesChange: (next: ScheduleRange[]) => void;
};

/**
 * Paso 3: "Información operativa". Todo opcional: la persona puede enviar la
 * solicitud sin cargar nada y completarlo después desde Configuración.
 */
export function OperationalStep({
  totalSpots,
  totalSpotsError,
  schedules,
  disabled,
  onTotalSpotsChange,
  onSchedulesChange,
}: Props) {
  return (
    <div className="onboarding-section">
      <h3>Información operativa</h3>
      <p className="section-hint">
        Este paso es opcional. Si no lo completás ahora, podés configurarlo más
        adelante desde Configuración.
      </p>

      <Input
        id="operational-total-spots"
        label="Capacidad total de vehículos (opcional)"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={totalSpots}
        onChange={(e) => onTotalSpotsChange(e.target.value)}
        placeholder="Ej.: 50"
        disabled={disabled}
        error={totalSpotsError}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>
          Horarios de atención (opcional)
        </strong>
        <WeeklyScheduleEditor
          value={schedules}
          onChange={onSchedulesChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
