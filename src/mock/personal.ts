import type { PersonalMember } from '../types/api';

export const PERSONAL: PersonalMember[] = [
  {
    id: '1',
    nombre: 'Carlos Mendoza',
    email: 'c.mendoza@parkit.com',
    rol: 'Administrador',
    sucursal: 'Palermo Centro',
    actividad_label: 'Hace 4 min',
    estado: 'active',
  },
  {
    id: '2',
    nombre: 'Sofía Iglesias',
    email: 's.iglesias@parkit.com',
    rol: 'Administrador',
    sucursal: 'Belgrano R',
    actividad_label: 'Hace 11 min',
    estado: 'active',
  },
  {
    id: '3',
    nombre: 'Diego Pelletti',
    email: 'd.pelletti@parkit.com',
    rol: 'Supervisor',
    sucursal: 'Núñez Norte',
    actividad_label: 'Hace 28 min',
    estado: 'active',
  },
  {
    id: '4',
    nombre: 'Lucía Aramburu',
    email: 'l.aramburu@parkit.com',
    rol: 'Administrador',
    sucursal: 'Recoleta',
    actividad_label: 'Hace 1 h',
    estado: 'active',
  },
  {
    id: '5',
    nombre: 'Mariano Reyes',
    email: 'm.reyes@parkit.com',
    rol: 'Administrador',
    sucursal: 'Microcentro',
    actividad_label: 'Hace 2 h',
    estado: 'active',
  },
  {
    id: '6',
    nombre: 'Hernán Vidal',
    email: 'h.vidal@parkit.com',
    rol: 'Operador de rampa',
    sucursal: 'Palermo Centro',
    actividad_label: 'Hace 2 min',
    estado: 'active',
  },
  {
    id: '7',
    nombre: 'Camila Ruiz',
    email: 'c.ruiz@parkit.com',
    rol: 'Operador de rampa',
    sucursal: 'Microcentro',
    actividad_label: 'Hace 14 min',
    estado: 'active',
  },
  {
    id: '8',
    nombre: 'Ezequiel Bordón',
    email: 'e.bordon@parkit.com',
    rol: 'Supervisor',
    sucursal: 'Palermo Centro',
    actividad_label: 'Hace 32 min',
    estado: 'active',
  },
  {
    id: '9',
    nombre: 'Romina Cetra',
    email: 'r.cetra@parkit.com',
    rol: 'Operador de rampa',
    sucursal: 'Belgrano R',
    actividad_label: 'Ayer',
    estado: 'inactive',
  },
];

export function getPersonalBySucursal(
  sucursalNombre: string,
): PersonalMember[] {
  return PERSONAL.filter((p) => p.sucursal === sucursalNombre);
}
