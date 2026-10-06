import { describe, expect, it } from 'vitest';
import { isLegacyEvidence, plateOverlayStyle } from './lprImage';

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
