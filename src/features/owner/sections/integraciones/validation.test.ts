import { describe, expect, it } from 'vitest';
import type { MpAccount } from '../../services/mercado-pago';
import { isAddressComplete, resolveMpCardState } from './validation';

const NOW = new Date('2026-09-20T12:00:00.000Z');

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeMpAccount(overrides: Partial<MpAccount> = {}): MpAccount {
  return {
    id: '9f1c2b3a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
    tenantId: '11111111-1111-7111-8111-111111111111',
    mpUserId: '446566691',
    status: 'linked',
    storeId: '1234567',
    posId: '2711382',
    externalPosId: 'parkit-11111111',
    qrImageUrl: 'https://www.mercadopago.com/instore/merchant/qr/2711382/a.png',
    qrTemplateDocumentUrl:
      'https://www.mercadopago.com/instore/merchant/qr/2711382/t.pdf',
    accessTokenExpiresAt: daysFromNow(120),
    lastRefreshAt: null,
    refreshFailureCount: 0,
    linkedAt: '2026-09-14T01:00:00.000Z',
    createdAt: '2026-09-14T01:00:00.000Z',
    updatedAt: '2026-09-14T01:00:00.000Z',
    ...overrides,
  };
}

describe('isAddressComplete', () => {
  it('exige calle, altura, ciudad y provincia', () => {
    expect(
      isAddressComplete({
        location: {
          streetName: 'Av. Corrientes',
          streetNumber: '1234',
          cityName: 'CABA',
          stateName: 'Ciudad Autónoma de Buenos Aires',
        },
      }),
    ).toBe(true);
  });

  it('rechaza la dirección a la que le falta un campo obligatorio', () => {
    expect(
      isAddressComplete({
        location: {
          streetName: 'Av. Corrientes',
          streetNumber: '1234',
          cityName: 'CABA',
          stateName: null,
        },
      }),
    ).toBe(false);
  });

  // Los tenants anteriores a la migración de `location` tienen todo en `null` y
  // sólo la dirección vieja de una línea: no alcanza para Mercado Pago.
  it('no da por completa la dirección de una línea de los tenants viejos', () => {
    expect(
      isAddressComplete({ location: null, address: 'Av. Corrientes 1234' }),
    ).toBe(false);
  });

  it('trata la entidad ausente como dirección incompleta', () => {
    expect(isAddressComplete(undefined)).toBe(false);
  });
});

describe('resolveMpCardState', () => {
  it('sin cuenta y sin dirección pide completar la dirección', () => {
    expect(
      resolveMpCardState({ account: null, addressComplete: false, now: NOW }),
    ).toEqual({ kind: 'address-incomplete' });
  });

  it('sin cuenta y con dirección ofrece vincular', () => {
    expect(
      resolveMpCardState({ account: null, addressComplete: true, now: NOW }),
    ).toEqual({ kind: 'unlinked' });
  });

  it('la cuenta rota gana sobre el aviso de dirección', () => {
    const account = makeMpAccount({ status: 'token_expired' });
    expect(
      resolveMpCardState({ account, addressComplete: false, now: NOW }),
    ).toEqual({ kind: 'broken', reason: 'token_expired' });
  });

  it('distingue el acceso revocado del token vencido', () => {
    const account = makeMpAccount({ status: 'revoked' });
    expect(
      resolveMpCardState({ account, addressComplete: true, now: NOW }),
    ).toEqual({ kind: 'broken', reason: 'revoked' });
  });

  it('a 29 días avisa que está por vencer', () => {
    const account = makeMpAccount({ accessTokenExpiresAt: daysFromNow(29) });
    expect(
      resolveMpCardState({ account, addressComplete: true, now: NOW }),
    ).toEqual({ kind: 'expiring', daysLeft: 29 });
  });

  it('a 30 y a 31 días todavía está tranquila', () => {
    const treinta = makeMpAccount({ accessTokenExpiresAt: daysFromNow(30) });
    const treintaYUno = makeMpAccount({
      accessTokenExpiresAt: daysFromNow(31),
    });
    expect(
      resolveMpCardState({ account: treinta, addressComplete: true, now: NOW }),
    ).toEqual({ kind: 'linked' });
    expect(
      resolveMpCardState({
        account: treintaYUno,
        addressComplete: true,
        now: NOW,
      }),
    ).toEqual({ kind: 'linked' });
  });

  // El backend marca `token_expired` desde un job: entre que vence y que el job
  // corre, el estado sigue siendo `linked` y la fecha ya quedó atrás.
  it('con el token vencido pero la cuenta todavía en linked, cae en 0 días', () => {
    const account = makeMpAccount({ accessTokenExpiresAt: daysFromNow(-3) });
    expect(
      resolveMpCardState({ account, addressComplete: true, now: NOW }),
    ).toEqual({ kind: 'expiring', daysLeft: 0 });
  });
});
