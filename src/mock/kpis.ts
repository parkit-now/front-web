import type { KpiSnapshot } from '../types/api';

const KPI_BY_SUCURSAL: Record<string, KpiSnapshot> = {
  palermo: {
    sucursal_id: 'palermo',
    ocupacion_pct: 84,
    ocupadas: 168,
    total: 200,
    ingresos_dia: 245000,
    ingresos_dia_delta_pct: 12,
    ingresos_mes: 3890000,
    ingresos_mes_proyectado: 4500000,
    sparkline_data: [
      22, 28, 24, 31, 27, 34, 29, 38, 33, 40, 37, 42, 38, 45, 41, 48,
    ],
  },
  belgrano: {
    sucursal_id: 'belgrano',
    ocupacion_pct: 67,
    ocupadas: 94,
    total: 140,
    ingresos_dia: 155000,
    ingresos_dia_delta_pct: -3,
    ingresos_mes: 2100000,
    ingresos_mes_proyectado: 2400000,
    sparkline_data: [
      18, 20, 22, 19, 24, 21, 23, 25, 22, 27, 24, 29, 26, 28, 25, 30,
    ],
  },
  microcentro: {
    sucursal_id: 'microcentro',
    ocupacion_pct: 91,
    ocupadas: 291,
    total: 320,
    ingresos_dia: 410000,
    ingresos_dia_delta_pct: 8,
    ingresos_mes: 6200000,
    ingresos_mes_proyectado: 7000000,
    sparkline_data: [
      35, 40, 38, 44, 42, 48, 45, 52, 49, 55, 51, 58, 54, 60, 57, 62,
    ],
  },
  recoleta: {
    sucursal_id: 'recoleta',
    ocupacion_pct: 45,
    ocupadas: 43,
    total: 96,
    ingresos_dia: 85000,
    ingresos_dia_delta_pct: 0,
    ingresos_mes: 980000,
    ingresos_mes_proyectado: 1100000,
    sparkline_data: [
      10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17, 19,
    ],
  },
  nunez: {
    sucursal_id: 'nunez',
    ocupacion_pct: 72,
    ocupadas: 130,
    total: 180,
    ingresos_dia: 198000,
    ingresos_dia_delta_pct: 5,
    ingresos_mes: 2850000,
    ingresos_mes_proyectado: 3200000,
    sparkline_data: [
      20, 23, 21, 25, 23, 27, 25, 29, 27, 31, 29, 33, 31, 35, 33, 37,
    ],
  },
};

const DEFAULT_KPI: KpiSnapshot = KPI_BY_SUCURSAL['palermo'];

export function getKpisBySucursal(sucursalId: string): KpiSnapshot {
  return KPI_BY_SUCURSAL[sucursalId] ?? DEFAULT_KPI;
}
