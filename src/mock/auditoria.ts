import type { AuditEvent, AuditSeveridad } from '../types/api';

interface AuditTemplate {
  t: string;
  sev: AuditSeveridad;
}
const ACTORS = [
  'Carlos Mendoza',
  'Sofía Iglesias',
  'Mariano Reyes',
  'Lucía Aramburu',
  'Diego Pelletti',
  'Hernán Vidal',
  'Sistema',
];
const TEMPLATES: AuditTemplate[] = [
  { t: 'modificó la tarifa de autos', sev: 'warn' },
  { t: 'aprobó nueva tarifa nocturna', sev: 'info' },
  { t: 'registró pago manual para la patente FX-992-ZZ', sev: 'info' },
  { t: 'alertó por exceso de tiempo en patente AA-123-BB', sev: 'crit' },
  { t: 'forzó salida de la patente CL-441-XR', sev: 'warn' },
  { t: 'invitó a nuevo operador como Operador de rampa', sev: 'info' },
  { t: 'reactivó la cuenta del usuario', sev: 'info' },
  { t: 'detectó intento de ingreso con patente duplicada', sev: 'crit' },
  { t: 'aumentó a 12 las plazas de tipo Auto', sev: 'info' },
  { t: 'cambió el método de pago "Cripto" a inactivo', sev: 'info' },
  { t: 'eliminó la plaza P-05 (tipo Moto)', sev: 'warn' },
  { t: 'rechazó el pago por monto incorrecto', sev: 'warn' },
  { t: 'exportó CSV de transacciones del mes', sev: 'info' },
  { t: 'modificó la dirección fiscal de la empresa', sev: 'info' },
  { t: 'cerró sesión inactiva del operador', sev: 'info' },
  { t: 'cambió rol de usuario a Supervisor', sev: 'info' },
  { t: 'editó el horario de atención', sev: 'info' },
  { t: 'redujo las plazas de tipo moto', sev: 'warn' },
  { t: 'actualizó datos de facturación', sev: 'info' },
  { t: 'suspendió temporalmente acceso al operador', sev: 'warn' },
];

function buildAuditoria(): AuditEvent[] {
  const events: AuditEvent[] = [];
  for (let i = 0; i < 64; i++) {
    const tmpl = TEMPLATES[i % TEMPLATES.length];
    const actor = ACTORS[i % ACTORS.length];
    const dayOffset = Math.floor(i / 16);
    const hour = (20 - (i % 24) + 24) % 24;
    const min = (60 - ((i * 7) % 60)) % 60;
    const sec = (60 - ((i * 13) % 60)) % 60;
    const ts = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    const fecha_label =
      dayOffset === 0
        ? 'Hoy'
        : dayOffset === 1
          ? 'Ayer'
          : `Hace ${dayOffset} días`;
    events.push({
      id: `AUD-${String(i + 1).padStart(3, '0')}`,
      actor_nombre: actor,
      accion: tmpl.t,
      severidad: tmpl.sev,
      ts,
      fecha_label,
    });
  }
  return events;
}

export const AUDITORIA: AuditEvent[] = buildAuditoria();
