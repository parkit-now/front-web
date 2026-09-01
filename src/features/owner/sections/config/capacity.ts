/**
 * Parsea el input de capacidad total.
 *
 * Devuelve el entero, o un mensaje de error. Se extrae del componente porque
 * este repo no tiene infraestructura para testear componentes: la lógica que
 * puede fallar vive en funciones puras, que sí se testean.
 */
export function parseCapacityTotal(
  raw: string,
): { total: number } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { error: 'Ingresá la cantidad de plazas.' };

  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { error: 'Tiene que ser un número entero.' };
  }
  if (value < 0) return { error: 'No puede ser negativo.' };
  return { total: value };
}
