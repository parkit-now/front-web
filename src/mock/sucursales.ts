import type { Sucursal } from '../types/api';

export const SUCURSALES: Sucursal[] = [
  {
    id: 'palermo',
    nombre: 'Palermo Centro',
    direccion: 'Av. Santa Fe 3401, CABA',
    estado: 'active',
    total_plazas: 200,
    plazas_auto: 160,
    plazas_moto: 30,
    plazas_bici: 10,
    ocupacion_pct: 84,
    gerente_nombre: 'Carlos Mendoza',
  },
  {
    id: 'belgrano',
    nombre: 'Belgrano R',
    direccion: 'Av. Cabildo 2189, CABA',
    estado: 'active',
    total_plazas: 140,
    plazas_auto: 110,
    plazas_moto: 20,
    plazas_bici: 10,
    ocupacion_pct: 67,
    gerente_nombre: 'Sofía Iglesias',
  },
  {
    id: 'microcentro',
    nombre: 'Microcentro',
    direccion: 'Reconquista 656, CABA',
    estado: 'active',
    total_plazas: 320,
    plazas_auto: 260,
    plazas_moto: 40,
    plazas_bici: 20,
    ocupacion_pct: 91,
    gerente_nombre: 'Mariano Reyes',
  },
  {
    id: 'recoleta',
    nombre: 'Recoleta',
    direccion: 'Av. Las Heras 1942, CABA',
    estado: 'maintenance',
    total_plazas: 96,
    plazas_auto: 80,
    plazas_moto: 10,
    plazas_bici: 6,
    ocupacion_pct: 45,
    gerente_nombre: 'Lucía Aramburu',
  },
  {
    id: 'nunez',
    nombre: 'Núñez Norte',
    direccion: 'Av. Cabildo 4501, CABA',
    estado: 'active',
    total_plazas: 180,
    plazas_auto: 140,
    plazas_moto: 30,
    plazas_bici: 10,
    ocupacion_pct: 72,
    gerente_nombre: 'Diego Pelletti',
  },
];

export function getSucursalesByTenant(tenantId: string): Sucursal[] {
  void tenantId;
  return SUCURSALES;
}

export function getSucursalById(id: string): Sucursal | undefined {
  return SUCURSALES.find((s) => s.id === id);
}
