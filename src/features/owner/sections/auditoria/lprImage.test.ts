import { describe, expect, it } from 'vitest';
import {
  isLegacyEvidence,
  plateCropStyle,
  plateOverlayStyle,
} from './lprImage';

describe('isLegacyEvidence', () => {
  it.each([
    ['con imagen y sin bbox es del formato viejo', 'ruta.jpg', null, true],
    [
      'con imagen y con bbox es del formato nuevo',
      'ruta.jpg',
      { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
      false,
    ],
    ['sin imagen no es ninguno de los dos', null, null, false],
    [
      'sin imagen pero con bbox tampoco',
      null,
      { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
      false,
    ],
  ])('%s', (_caso, imageStoragePath, plateBbox, esperado) => {
    expect(isLegacyEvidence({ imageStoragePath, plateBbox })).toBe(esperado);
  });
});

describe('plateCropStyle', () => {
  it('acerca a la patente con escala uniforme', () => {
    // Una patente chica y centrada: el recorte tiene que ampliar de verdad.
    const style = plateCropStyle({ x: 0.45, y: 0.45, w: 0.1, h: 0.05 });
    const scale = Number(/scale\(([\d.]+)\)/.exec(String(style.transform))![1]);
    expect(scale).toBeGreaterThan(1);
    // Una sola escala para los dos ejes: si fueran distintas, el auto se
    // deformaría.
    expect(String(style.transform)).toMatch(/^scale\([\d.]+\)$/);
  });

  it('centra el origen en el medio del recorte', () => {
    const style = plateCropStyle({ x: 0.4, y: 0.4, w: 0.2, h: 0.1 });
    // El centro horizontal de la patente es 0,5 y el recorte es simétrico.
    expect(style.transformOrigin).toContain('50%');
  });

  it('no amplía más allá del tope: pasado ese punto se ve puré', () => {
    const style = plateCropStyle({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 });
    const scale = Number(/scale\(([\d.]+)\)/.exec(String(style.transform))![1]);
    expect(scale).toBeLessThanOrEqual(6);
  });

  it('no recorta si la patente ya ocupa casi todo el cuadro', () => {
    // Recortar acá no aporta y arriesga dejar afuera parte del vehículo.
    expect(plateCropStyle({ x: 0.05, y: 0.3, w: 0.9, h: 0.2 })).toEqual({});
  });

  it('clampea contra los bordes sin romperse', () => {
    const style = plateCropStyle({ x: 0, y: 0, w: 0.1, h: 0.05 });
    expect(style.transform).toBeDefined();
    const origin = String(style.transformOrigin);
    for (const pct of origin.match(/[\d.]+(?=%)/g) ?? []) {
      expect(Number(pct)).toBeGreaterThanOrEqual(0);
      expect(Number(pct)).toBeLessThanOrEqual(100);
    }
  });
});

describe('plateOverlayStyle', () => {
  it('traduce fracciones a porcentajes', () => {
    expect(plateOverlayStyle({ x: 0.25, y: 0.5, w: 0.1, h: 0.2 })).toEqual({
      left: '25%',
      top: '50%',
      width: '10%',
      height: '20%',
    });
  });
});
