import { describe, expect, it } from 'vitest';
import type { StaffMembership } from '../../services/staff';
import {
  LAST_OWNER_REASON,
  SELF_MANAGEMENT_REASON,
  membershipPermissions,
} from './permissions';

const ME = 'user-me';
const OTHER = 'user-other';

function membership(overrides: Partial<StaffMembership> = {}): StaffMembership {
  return {
    tenantId: 'tenant-1',
    tenantName: 'Estacionamiento Once',
    role: 'operator',
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('membershipPermissions · nadie se gestiona a sí mismo', () => {
  it('bloquea todo en la propia fila, aunque haya otros dueños', () => {
    expect(
      membershipPermissions({
        memberId: ME,
        currentUserId: ME,
        membership: membership({ role: 'owner' }),
        ownerCount: 5,
      }),
    ).toEqual({
      canChangeRole: false,
      canRemove: false,
      reason: SELF_MANAGEMENT_REASON,
    });
  });

  it('tiene prioridad sobre la regla del último dueño', () => {
    const result = membershipPermissions({
      memberId: ME,
      currentUserId: ME,
      membership: membership({ role: 'owner' }),
      ownerCount: 1,
    });
    expect(result.reason).toBe(SELF_MANAGEMENT_REASON);
  });

  it('no bloquea a nadie si todavía no sabemos quién está logueado', () => {
    const result = membershipPermissions({
      memberId: ME,
      currentUserId: null,
      membership: membership(),
      ownerCount: 2,
    });
    expect(result.canChangeRole).toBe(true);
  });
});

describe('membershipPermissions · siempre queda un dueño', () => {
  it('bloquea al único dueño de la sucursal', () => {
    expect(
      membershipPermissions({
        memberId: OTHER,
        currentUserId: ME,
        membership: membership({ role: 'owner' }),
        ownerCount: 1,
      }),
    ).toEqual({
      canChangeRole: false,
      canRemove: false,
      reason: LAST_OWNER_REASON,
    });
  });

  it('habilita a un dueño cuando hay otro', () => {
    expect(
      membershipPermissions({
        memberId: OTHER,
        currentUserId: ME,
        membership: membership({ role: 'owner' }),
        ownerCount: 2,
      }),
    ).toEqual({ canChangeRole: true, canRemove: true });
  });

  // La regla es sobre dueños: un operador no deja la playa sin dueño al irse.
  it('no alcanza a un operador aunque haya un solo dueño', () => {
    expect(
      membershipPermissions({
        memberId: OTHER,
        currentUserId: ME,
        membership: membership({ role: 'operator' }),
        ownerCount: 1,
      }),
    ).toEqual({ canChangeRole: true, canRemove: true });
  });

  it('bloquea sin explicación mientras el conteo carga', () => {
    expect(
      membershipPermissions({
        memberId: OTHER,
        currentUserId: ME,
        membership: membership({ role: 'owner' }),
        ownerCount: undefined,
      }),
    ).toEqual({ canChangeRole: false, canRemove: false });
  });

  it('no espera el conteo para habilitar a un operador', () => {
    expect(
      membershipPermissions({
        memberId: OTHER,
        currentUserId: ME,
        membership: membership({ role: 'operator' }),
        ownerCount: undefined,
      }),
    ).toEqual({ canChangeRole: true, canRemove: true });
  });
});
