import type { CSSProperties } from 'react';

export interface PlateBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * El mismo margen alrededor de la patente que usa el servicio de cámara
 * (`_crop_to_plate` en `services/camera/main.py`) y el desktop.
 *
 * OJO: está escrito en tres lados. Si divergen, el dueño y el operador ven
 * encuadres distintos del mismo evento y nadie entiende por qué.
 */
const PAD_X = 0.4;
const PAD_Y = 0.6;

/**
 * El zoom máximo que tiene sentido aplicar.
 *
 * Una patente chiquita dentro de una imagen de 1280 px no aguanta más: pasado
 * este punto se ve puré y el recorte es peor que la imagen entera.
 */
const MAX_SCALE = 6;

/**
 * Si ya ocupa casi todo el cuadro, recortar no aporta nada y sólo arriesga
 * dejar afuera parte del vehículo.
 */
const MIN_CROP_RATIO = 0.8;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
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

/**
 * Acerca la imagen a la patente, sin deformarla.
 *
 * Usa `transform: scale()` con el origen en el centro del recorte, y no
 * `width`/`height` por separado: el escalado uniforme mantiene las
 * proporciones del vehículo. Y como `transform-origin` en porcentajes es
 * relativo al border-box de la imagen, que es exactamente el sistema de
 * coordenadas del bbox normalizado, no hace falta convertir a píxeles ni
 * conocer el tamaño renderizado.
 *
 * Se hace con CSS y no con canvas a propósito: la imagen llega por una URL
 * firmada de Supabase, y dibujarla en un canvas lo dejaría *tainted* salvo que
 * el bucket devuelva CORS — un fallo que además aparecería tarde y raro.
 */
export function plateCropStyle(bbox: PlateBbox): CSSProperties {
  const padX = bbox.w * PAD_X;
  const padY = bbox.h * PAD_Y;
  const x1 = clamp01(bbox.x - padX);
  const y1 = clamp01(bbox.y - padY);
  const x2 = clamp01(bbox.x + bbox.w + padX);
  const y2 = clamp01(bbox.y + bbox.h + padY);
  const cropW = x2 - x1;
  const cropH = y2 - y1;

  if (cropW <= 0 || cropH <= 0 || cropW > MIN_CROP_RATIO) return {};

  const scale = Math.min(1 / cropW, MAX_SCALE);
  return {
    transformOrigin: `${pct((x1 + x2) / 2)} ${pct((y1 + y2) / 2)}`,
    transform: `scale(${Number(scale.toFixed(4))})`,
  };
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
