import { describe, expect, it } from 'vitest';
import {
  deletionBadgeLabel,
  normalizeParkingName,
  parkingNameMatches,
} from './parkingNameMatch';

describe('parkingNameMatches', () => {
  it('acepta el nombre exacto', () => {
    expect(parkingNameMatches('Playa Centro', 'Playa Centro')).toBe(true);
  });

  it('rechaza otro nombre', () => {
    expect(parkingNameMatches('Playa Norte', 'Playa Centro')).toBe(false);
  });

  it('acepta la misma tilde escrita en NFD y en NFC', () => {
    // Si esto se rompe, el admin tipea el nombre correcto, el botón NO se
    // habilita y no hay forma de darse cuenta mirando la pantalla.
    const nfc = 'Garage Belgrano Sótano';
    expect(parkingNameMatches(nfc.normalize('NFD'), nfc)).toBe(true);
  });

  it('ignora mayúsculas y espacios de los bordes', () => {
    expect(parkingNameMatches('  playa CENTRO  ', 'Playa Centro')).toBe(true);
  });

  it('NO ignora espacios del medio', () => {
    expect(parkingNameMatches('PlayaCentro', 'Playa Centro')).toBe(false);
  });

  it('un nombre vacío no confirma nada', () => {
    expect(parkingNameMatches('   ', 'Playa Centro')).toBe(false);
  });

  it('normaliza a NFC, igual que el backend', () => {
    expect(normalizeParkingName('Sótano'.normalize('NFD'))).toBe(
      'sótano'.normalize('NFC'),
    );
  });
});

describe('deletionBadgeLabel', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');

  it('cuenta los días que faltan para la purga', () => {
    expect(deletionBadgeLabel('2026-10-15T12:00:00.000Z', now)).toBe(
      'Eliminado · se borra en 10 días',
    );
  });

  it('dice "mañana" cuando queda un día', () => {
    expect(deletionBadgeLabel('2026-10-06T12:00:00.000Z', now)).toBe(
      'Eliminado · se borra mañana',
    );
  });

  it('con la fecha ya cumplida avisa que se va en la próxima limpieza', () => {
    // Es el caso de graceDays 0, que es como se limpian los datos de prueba.
    expect(deletionBadgeLabel('2026-10-05T12:00:00.000Z', now)).toBe(
      'Eliminado · se borra en la próxima limpieza',
    );
  });

  it('redondea hacia arriba: unas horas todavía son un día', () => {
    expect(deletionBadgeLabel('2026-10-05T20:00:00.000Z', now)).toBe(
      'Eliminado · se borra mañana',
    );
  });

  it('sin fecha, o con una inválida, se queda en lo que sabe', () => {
    expect(deletionBadgeLabel(null, now)).toBe('Eliminado');
    expect(deletionBadgeLabel('no es una fecha', now)).toBe('Eliminado');
  });
});
