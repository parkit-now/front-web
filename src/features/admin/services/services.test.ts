import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveApplication,
  getApplicationDetail,
  getDocumentSignedUrl,
  listApplications,
  readDeclaredEntity,
  rejectApplication,
  type ApplicationDetail,
} from './applications';
import {
  createParking,
  deleteParking,
  getDeletionPreflight,
  getParking,
  listParkings,
  restoreParking,
  updateParking,
} from './parkings';
import {
  addMembership,
  deleteUser,
  getUser,
  listUsers,
  removeMembership,
  updateMembership,
  updateUserRole,
} from './users';

const mock = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }));
vi.mock('../../../lib/api/client', () => ({ apiRequest: mock.request }));
vi.mock('../../../lib/supabase/session', () => ({ getSession: mock.session }));

beforeEach(() => {
  mock.request.mockReset();
  mock.request.mockResolvedValue({});
  mock.session.mockReset();
  mock.session.mockResolvedValue({ access_token: 'token' });
});

/** `MÉTODO path` de cada llamada, en orden. */
function requests() {
  return mock.request.mock.calls.map(([call]) => {
    const { method, path } = call as { method: string; path: string };
    return `${method} ${path}`;
  });
}

describe('servicios de administración', () => {
  it('usuarios: listado con búsqueda y ABM de relaciones', async () => {
    await listUsers({});
    await listUsers({ search: '  ana ', page: 2, pageSize: 20 });
    await getUser('u');
    await updateUserRole('u', 'admin');
    await deleteUser('u');
    await addMembership('u', { parkingId: 'p', role: 'owner' });
    await updateMembership('u', 'p', { role: 'operator' });
    await removeMembership('u', 'p');

    expect(requests()).toEqual([
      'GET /admin/users',
      'GET /admin/users?search=ana&page=2&pageSize=20',
      'GET /admin/users/u',
      'PATCH /admin/users/u',
      'DELETE /admin/users/u',
      'POST /admin/users/u/memberships',
      'PATCH /admin/users/u/memberships/p',
      'DELETE /admin/users/u/memberships/p',
    ]);
  });

  it('estacionamientos: listado, alta, baja y restauración', async () => {
    await listParkings({});
    await listParkings({ search: 'once', includeDeleted: true, page: 1 });
    await getParking('p');
    await createParking({ name: 'Playa' } as never);
    await updateParking('p', { name: 'Playa 2' } as never);
    await getDeletionPreflight('p');
    await deleteParking('p', { confirmName: 'Playa', graceDays: 30 });
    await restoreParking('p');

    expect(requests()).toEqual([
      'GET /admin/parkings',
      'GET /admin/parkings?search=once&page=1&includeDeleted=true',
      'GET /admin/parkings/p',
      'POST /admin/parkings',
      'PATCH /admin/parkings/p',
      'GET /admin/parkings/p/deletion-preflight',
      'POST /admin/parkings/p/deletion',
      'POST /admin/parkings/p/restore',
    ]);
  });

  it('solicitudes: revisión, documentos y resolución', async () => {
    await listApplications();
    await listApplications('pending');
    await getApplicationDetail('a');
    await getDocumentSignedUrl('a', 'd', 'attachment');
    await approveApplication('a');
    await rejectApplication('a', 'sin habilitación');

    expect(requests()).toEqual([
      'GET /admin/applications',
      'GET /admin/applications?status=pending',
      'GET /admin/applications/a',
      'GET /admin/applications/a/documents/d/signed-url?disposition=attachment',
      'POST /admin/applications/a/approve',
      'POST /admin/applications/a/reject',
    ]);
    expect(mock.request.mock.calls.at(-1)?.[0]).toMatchObject({
      body: { reason: 'sin habilitación' },
    });
  });

  it('lee la entidad declarada sólo si es un objeto', () => {
    expect(readDeclaredEntity(null)).toEqual({});
    expect(
      readDeclaredEntity({
        declaredEntity: 'x',
      } as unknown as ApplicationDetail),
    ).toEqual({});
    expect(
      readDeclaredEntity({
        declaredEntity: { name: 'Playa' },
      } as unknown as ApplicationDetail),
    ).toEqual({ name: 'Playa' });
  });

  it('sin sesión no llama al backend', async () => {
    mock.session.mockResolvedValue(null);

    await expect(listUsers({})).rejects.toThrow('No active session');
    await expect(listParkings({})).rejects.toThrow('No active session');
    await expect(listApplications()).rejects.toThrow('No active session');
    expect(mock.request).not.toHaveBeenCalled();
  });
});
