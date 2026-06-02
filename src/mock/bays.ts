import type { Bay, BayType, BayStatus } from '../types/api';

const PLATES_AUTO = [
  'AA-123-BB',
  'FX-992-ZZ',
  'LM-401-QR',
  'HG-721-PP',
  'DZ-118-XY',
  'SR-302-VV',
  'KP-840-CN',
  'BT-115-EL',
  'OL-200-RM',
  'UQ-633-AS',
  'MR-481-LX',
  'VC-907-AT',
  'EW-310-BB',
  'PJ-126-NN',
  'TY-555-OO',
  'XR-849-EE',
  'NB-731-MM',
  'GA-216-AC',
  'RS-908-BB',
  'CL-441-XR',
  'JT-602-VK',
  'MW-715-LO',
  'PD-309-AC',
  'YK-118-BR',
];
const PLATES_MOTO = [
  'M-1240-AB',
  'M-5821-CD',
  'M-7104-EF',
  'M-3392-GH',
  'M-2218-JK',
  'M-9904-LM',
];
const PLATES_BICI = ['BIKE-#142', 'BIKE-#089', 'BIKE-#221', 'BIKE-#005'];
const COLORS = ['Negro', 'Gris', 'Blanco', 'Azul', 'Rojo', 'Plateado', 'Verde'];
const MODELS_AUTO = [
  'Audi A4',
  'Toyota Corolla',
  'VW Golf',
  'Ford Focus',
  'Honda Civic',
  'Renault Logan',
  'Peugeot 208',
  'Citroën C3',
  'Toyota Hilux',
  'Ford Ranger',
  'VW Amarok',
  'Renault Duster',
  'Jeep Renegade',
  'Hyundai Tucson',
];
const MODELS_MOTO = [
  'Honda Wave 110',
  'Yamaha YBR 125',
  'Bajaj Rouser 200',
  'Zanella ZB 110',
  'Honda Tornado',
];
const MODELS_BICI = ['Mountain bike', 'Urbana eléctrica', 'Plegable', 'BMX'];
const CUSTOMERS = [
  'Juan Pérez',
  'María Gómez',
  'Andrés Liu',
  'Cecilia Soto',
  'Roberto D.',
  'Verónica Mansilla',
  'Federico Garay',
  'Paula Olarte',
  'Sebastián Riquelme',
  'Marina Solá',
];

// Flat per-type spot capacity (zones were removed). Slots are numbered
// sequentially across the whole lot (`P-01`, `P-02`, ...).
const CAPACITY: Record<BayType, number> = { auto: 34, moto: 10, bici: 4 };

const BAY_TYPES: BayType[] = ['auto', 'moto', 'bici'];

// Deterministic pseudo-random based on index to avoid re-renders changing data
function deterministicRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function buildBays(sucursalId: string): Bay[] {
  const bays: Bay[] = [];
  let plateAutoIdx = 0;
  let plateMotoIdx = 0;
  let plateBiciIdx = 0;
  let globalIdx = 0;
  let slotIdx = 1;

  // Use sucursalId to vary data per sucursal
  const seedOffset = sucursalId.length * 7;

  BAY_TYPES.forEach((tipo) => {
    const count = CAPACITY[tipo] ?? 0;
    for (let i = 0; i < count; i++) {
      const slotId = `P-${String(slotIdx).padStart(2, '0')}`;
      slotIdx++;
      const rnd = deterministicRandom(globalIdx + seedOffset);
      globalIdx++;

      let status: BayStatus = 'vacant';
      if (rnd < 0.62) status = 'occupied';
      else if (rnd < 0.7) status = 'overdue';
      else if (rnd < 0.78) status = 'reserved';

      if (status !== 'vacant') {
        let patente: string;
        let modelo: string;
        let tarifa: number;

        if (tipo === 'moto') {
          patente = PLATES_MOTO[plateMotoIdx % PLATES_MOTO.length];
          plateMotoIdx++;
          modelo =
            MODELS_MOTO[
              Math.floor(deterministicRandom(globalIdx) * MODELS_MOTO.length)
            ];
          tarifa = 600;
        } else if (tipo === 'bici') {
          patente = PLATES_BICI[plateBiciIdx % PLATES_BICI.length];
          plateBiciIdx++;
          modelo =
            MODELS_BICI[
              Math.floor(deterministicRandom(globalIdx) * MODELS_BICI.length)
            ];
          tarifa = 200;
        } else {
          patente = PLATES_AUTO[plateAutoIdx % PLATES_AUTO.length];
          plateAutoIdx++;
          modelo =
            MODELS_AUTO[
              Math.floor(deterministicRandom(globalIdx) * MODELS_AUTO.length)
            ];
          tarifa = 1200;
        }

        const hour = 8 + Math.floor(deterministicRandom(globalIdx + 1) * 12);
        const min = Math.floor(deterministicRandom(globalIdx + 2) * 60);
        const ingreso_at = `2026-05-30T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`;
        const excedido_min =
          status === 'overdue'
            ? 15 + Math.floor(deterministicRandom(globalIdx + 5) * 40)
            : null;
        const monto_actual =
          Math.round(
            (tarifa + deterministicRandom(globalIdx + 6) * tarifa) * 100,
          ) / 100;
        const cliente =
          CUSTOMERS[
            Math.floor(deterministicRandom(globalIdx + 7) * CUSTOMERS.length)
          ];
        const color =
          tipo === 'bici'
            ? '—'
            : COLORS[
                Math.floor(deterministicRandom(globalIdx + 8) * COLORS.length)
              ];

        bays.push({
          id: slotId,
          sucursal_id: sucursalId,
          tipo,
          status,
          patente,
          modelo,
          color,
          cliente_nombre: cliente,
          cliente_telefono: `+5411 ${4000 + Math.floor(deterministicRandom(globalIdx + 9) * 5999)}-${1000 + Math.floor(deterministicRandom(globalIdx + 10) * 8999)}`,
          ingreso_at,
          excedido_min,
          reserva_id:
            status === 'reserved'
              ? `RSV-${90000 + Math.floor(deterministicRandom(globalIdx + 11) * 9999)}`
              : null,
          tarifa_por_hora: tarifa,
          monto_actual,
        });
      } else {
        bays.push({
          id: slotId,
          sucursal_id: sucursalId,
          tipo,
          status: 'vacant',
          patente: null,
          modelo: null,
          color: null,
          cliente_nombre: null,
          cliente_telefono: null,
          ingreso_at: null,
          excedido_min: null,
          reserva_id: null,
          tarifa_por_hora: tipo === 'bici' ? 200 : tipo === 'moto' ? 600 : 1200,
          monto_actual: null,
        });
      }
    }
  });

  return bays;
}
