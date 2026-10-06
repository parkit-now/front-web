/**
 * Compara el nombre que tipeó el admin contra el del estacionamiento.
 *
 * GEMELO EXACTO de `backend/src/admin/parkings/parking-name-match.ts`. El
 * código está duplicado porque los repos no comparten módulos, pero las dos
 * reglas tienen que coincidir: esto decide si se habilita el botón y el
 * backend decide si acepta el pedido. Si divergen, el botón se prende y el
 * servidor rechaza, que es la peor combinación posible.
 *
 * POR QUÉ NORMALIZAR
 *
 * El nombre se copia y se pega. Una "ó" puede venir como un solo code point
 * (U+00F3, NFC) o como "o" + tilde combinante (U+006F U+0301, NFD) según de
 * dónde salga el texto — macOS entrega NFD en el portapapeles. Los dos se ven
 * IDÉNTICOS en pantalla y `===` dice que son distintos.
 */
export function normalizeParkingName(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('es');
}

/** Si lo tipeado identifica a este estacionamiento. */
export function parkingNameMatches(typed: string, actual: string): boolean {
  return normalizeParkingName(typed) === normalizeParkingName(actual);
}

/**
 * El texto del badge de un estacionamiento dado de baja.
 *
 * Pura para poder testearla: en este repo los tests corren sin DOM.
 */
export function deletionBadgeLabel(
  purgeAfter: string | null,
  now = new Date(),
): string {
  if (!purgeAfter) return 'Eliminado';

  const purge = new Date(purgeAfter);
  if (Number.isNaN(purge.getTime())) return 'Eliminado';

  // Se compara por día y no por milisegundos: lo que le importa a quien mira
  // la tabla es "¿me queda tiempo para restaurarlo?", y un borrado que vence
  // dentro de tres horas ya es "hoy".
  const days = Math.ceil((purge.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return 'Eliminado · se borra en la próxima limpieza';
  if (days === 1) return 'Eliminado · se borra mañana';
  return `Eliminado · se borra en ${days} días`;
}
