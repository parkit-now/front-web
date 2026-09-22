// Mock types — contrato mínimo que el backend deberá cumplir.
// Cuando exista el backend, ejecutar `make sync-types` para reemplazar con tipos OpenAPI.

export type BayType = 'auto' | 'moto' | 'bici';
export type BayStatus = 'occupied' | 'overdue' | 'reserved' | 'vacant';
export type UserRole = 'owner' | 'admin' | 'supervisor' | 'operator';
export type SucursalEstado = 'active' | 'maintenance';

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
