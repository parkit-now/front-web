// Mock types — contrato mínimo que el backend deberá cumplir.
// Cuando exista el backend, ejecutar `make sync-types` para reemplazar con tipos OpenAPI.

export type BayType = 'auto' | 'moto' | 'bici';
export type BayStatus = 'occupied' | 'overdue' | 'reserved' | 'vacant';
export type UserRole = 'owner' | 'admin' | 'supervisor' | 'operator';
export type SucursalEstado = 'active' | 'maintenance';
export type TransactionEstado = 'ok' | 'failed' | 'cancelled';
export type AuditSeveridad = 'info' | 'warn' | 'crit';

export interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  estado: SucursalEstado;
  total_plazas: number;
  plazas_auto: number;
  plazas_moto: number;
  plazas_bici: number;
  ocupacion_pct: number;
  gerente_nombre: string;
}

export interface Bay {
  id: string;
  sucursal_id: string;
  tipo: BayType;
  status: BayStatus;
  patente: string | null;
  modelo: string | null;
  color: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  ingreso_at: string | null;
  excedido_min: number | null;
  reserva_id: string | null;
  tarifa_por_hora: number;
  monto_actual: number | null;
}

export interface KpiSnapshot {
  sucursal_id: string;
  ocupacion_pct: number;
  ocupadas: number;
  total: number;
  ingresos_dia: number;
  ingresos_dia_delta_pct: number;
  ingresos_mes: number;
  ingresos_mes_proyectado: number;
  sparkline_data: number[];
}

export interface Transaction {
  id: string;
  sucursal_id: string;
  patente: string;
  cliente: string;
  monto: number;
  medio_pago: string;
  estado: TransactionEstado;
  fecha_label: string;
  procesado_at: string;
}

export interface PersonalMember {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  sucursal: string;
  actividad_label: string;
  estado: 'active' | 'inactive';
}

export interface AuditEvent {
  id: string;
  actor_nombre: string;
  accion: string;
  severidad: AuditSeveridad;
  ts: string;
  fecha_label: string;
}

export interface MedioPago {
  id: string;
  nombre: string;
  activo: boolean;
  es_default: boolean;
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  es_interno: boolean;
  ultimo_acceso_label: string;
  estado: 'active' | 'suspended';
}
