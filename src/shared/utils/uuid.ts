/**
 * UUIDv7 generado en el cliente.
 *
 * El backend exige `id` en el body de `POST /tenants/:tenantId/rates`: el
 * contrato nació para que la app desktop pueda dar de alta tarifas estando
 * offline y empujarlas después. La web no tiene esa necesidad, pero comparte el
 * endpoint, así que también tiene que generar el id.
 *
 * Se usa v7 y no `crypto.randomUUID()` (que es v4) para que los ids escritos
 * desde los dos frontends sobre la misma tabla mantengan el mismo orden
 * temporal.
 */
export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const timestamp = BigInt(Date.now());
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Nibble de versión (7) y bits de variante RFC 4122 (10xx).
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
