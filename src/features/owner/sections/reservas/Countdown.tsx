import { useNow } from '../../hooks/useReservations';
import { countdownTo } from './reservationUtils';

/**
 * Cuenta regresiva hasta `approvalDeadlineAt`. Cada instancia tiene su propio
 * reloj de 1 s: son pocas filas (solo "Por aceptar") y así la tabla no se
 * vuelve a renderizar entera cada segundo.
 */
export function Countdown({
  deadlineAt,
  prefix = 'Responder en ',
}: {
  deadlineAt: string | null;
  prefix?: string;
}) {
  const now = useNow(deadlineAt !== null);
  const countdown = countdownTo(deadlineAt, now);
  if (!countdown) return null;
  if (countdown.expired) {
    return (
      <span style={{ color: 'var(--err, #b42318)', fontSize: 12 }}>
        Venció el plazo: se rechaza sola
      </span>
    );
  }
  return (
    <span
      role="timer"
      aria-label={`${prefix}${countdown.label}`}
      style={{
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        color: countdown.urgent ? 'var(--err, #b42318)' : 'var(--text-2)',
        fontWeight: countdown.urgent ? 600 : 400,
      }}
    >
      {prefix}
      <span style={{ fontFamily: 'var(--mono)' }}>{countdown.label}</span>
    </span>
  );
}
