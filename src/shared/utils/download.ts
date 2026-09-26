/**
 * Descarga un archivo ya bajado (el PDF de una factura, un CSR).
 *
 * La URL `blob:` se revoca DESPUÉS, no en el mismo tick del `click()`: Chrome
 * arranca la descarga de forma asíncrona y, si la URL ya no existe, ignora el
 * atributo `download` y guarda el archivo con el id del blob (un UUID sin
 * extensión). Pasó con el PDF de las facturas y con el CSR.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
