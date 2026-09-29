/**
 * «Descargar PDF» de la web: el comprobante (`renderInvoiceHtml`) se imprime
 * con el diálogo del navegador, donde el dueño elige «Guardar como PDF». No
 * hay PDF en el backend ni librerías: lo dibuja el propio navegador.
 */

/**
 * CSS que sólo existe al imprimir desde la web:
 * - `@page` A4 sin márgenes: así el navegador no agrega su encabezado y pie
 *   (URL, fecha), que vive en el margen. El margen lo pone el `body`.
 * - `.page` con el alto de la hoja (menos 2 mm contra el redondeo, que si no
 *   empuja una hoja en blanco): la plantilla es una columna flex con los
 *   totales en `margin-top: auto`, así que quedan al pie, como en el PDF del
 *   desktop.
 */
const PRINT_STYLES = `<style media="print">
  @page{size:A4;margin:0}
  body{padding:10mm 10mm 18mm}
  .page{min-height:calc(297mm - 28mm - 2mm)}
</style>`;

/**
 * El HTML listo para imprimir: con el CSS de impresión y con `title` como
 * título, que es el nombre que el navegador propone al guardar el PDF.
 */
export function printableInvoiceHtml(html: string, title: string): string {
  const safeTitle = title.replace(/[<>&"']/g, '');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace('</head>', `${PRINT_STYLES}\n</head>`);
}

/** Espera máxima a que el iframe cargue (el QR va como data URL: es inmediato). */
const LOAD_TIMEOUT_MS = 10_000;

/**
 * Abre el diálogo de impresión con el comprobante. En un iframe oculto y no en
 * una pestaña: `window.open` después de esperar al backend lo bloquea el
 * navegador (ya no es «en respuesta a un click»). Chrome propone el título
 * de la página de arriba como nombre del archivo, así que se cambia mientras
 * dura el diálogo.
 */
export async function printInvoice(html: string, title: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  // Ancho de una A4, para que la plantilla se arme como en la hoja.
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(frame);

  const previousTitle = document.title;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('print-frame-timeout')),
        LOAD_TIMEOUT_MS,
      );
      frame.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      frame.srcdoc = printableInvoiceHtml(html, title);
    });
    const win = frame.contentWindow;
    if (!win) throw new Error('print-frame-unavailable');
    document.title = title;
    // `print()` bloquea hasta que se cierra el diálogo en Chrome y Firefox.
    win.focus();
    win.print();
  } finally {
    document.title = previousTitle;
    // Safari vuelve de `print()` antes de cerrar el diálogo: se saca el iframe
    // un rato después para no cortarle la impresión.
    window.setTimeout(() => frame.remove(), 60_000);
  }
}
