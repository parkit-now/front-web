export function fmtMoney(n: number): string {
  return (
    '$' +
    n.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtMoney0(n: number): string {
  return (
    '$' +
    n.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

export function normalizePatente(q: string): string {
  return q.replace(/[-\s]/g, '').toUpperCase();
}

export function formatElapsed(ingreso_at: string): string {
  const now = new Date('2026-05-30T20:00:00Z'); // mock "now"
  const ingreso = new Date(ingreso_at);
  const diffMs = now.getTime() - ingreso.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const AR_DATE_TIME = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Argentina/Buenos_Aires',
});

/**
 * Fecha y hora fijadas al huso de Argentina, igual que el desktop
 * (`front-desktop/src/lib/format/argentina.ts`). La zona va explícita para que
 * un usuario en otro huso vea la misma hora que el operador en la playa.
 */
export function fmtDateTimeAr(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return AR_DATE_TIME.format(parsed);
}
