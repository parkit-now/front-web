import type { Zona, MedioPago } from '../types/api';

export const ZONAS_DEFAULT: Zona[] = [
  {
    id: 'zona-a',
    nombre: 'Zona A',
    plazas_auto: 16,
    plazas_moto: 0,
    plazas_bici: 0,
  },
  {
    id: 'zona-b',
    nombre: 'Zona B',
    plazas_auto: 14,
    plazas_moto: 2,
    plazas_bici: 0,
  },
  {
    id: 'zona-c',
    nombre: 'Zona C',
    plazas_auto: 4,
    plazas_moto: 8,
    plazas_bici: 4,
  },
];

export const MEDIOS_PAGO: MedioPago[] = [
  {
    id: 'mp',
    nombre: 'Transferencia (Mercado Pago)',
    activo: true,
    es_default: true,
  },
  { id: 'efectivo', nombre: 'Efectivo', activo: true, es_default: true },
  {
    id: 'tarjeta',
    nombre: 'Tarjeta de débito/crédito',
    activo: true,
    es_default: false,
  },
];
