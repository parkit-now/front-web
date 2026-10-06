import type { CSSProperties } from 'react';

export interface PlateBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Porcentaje sin la cola de punto flotante.
 *
 * `0.5 * 100` puede dar `50.000000000000014`, y eso termina tal cual en el
 * atributo `style` del DOM. Cuatro decimales sobre una imagen de 1280 px son
 * 0,001 px: precisión de sobra.
 */
function pct(fraction: number): string {
  return `${Number((fraction * 100).toFixed(4))}%`;
}

/**
 * Si la imagen de este evento es del formato viejo.
 *
 * Sin `plateBbox`, el binario del bucket **ya es** el recorte de la patente,
 * con el recuadro verde quemado. Recortarlo otra vez dejaría un puñado de
 * píxeles, así que hay que mostrarlo tal cual.
 */
export function isLegacyEvidence(event: {
  imageStoragePath?: string | null;
  plateBbox?: PlateBbox | null;
}): boolean {
  return Boolean(event.imageStoragePath) && !event.plateBbox;
}

/** El recuadro verde sobre la imagen sin recortar, en porcentajes. */
export function plateOverlayStyle(bbox: PlateBbox): CSSProperties {
  return {
    left: pct(bbox.x),
    top: pct(bbox.y),
    width: pct(bbox.w),
    height: pct(bbox.h),
  };
}
