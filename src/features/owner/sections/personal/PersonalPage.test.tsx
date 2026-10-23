// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type { StaffMember } from '../../services/staff';
import { PersonalPage } from './PersonalPage';

const CENTRO = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const NORTE = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';

const http = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../../../../lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiRequest: http.request,
}));
vi.mock('../../../../lib/supabase/session', () => ({
  getSession: () => Promise.resolve({ access_token: 'token' }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'me',
}));
vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: CENTRO,
    sucursal: { id: CENTRO, nombre: 'Centro', role: 'owner' },
    sucursales: [
      { id: CENTRO, nombre: 'Centro', role: 'owner', estado: 'active' },
      { id: NORTE, nombre: 'Norte', role: 'owner', estado: 'active' },
    ],
    isLoading: false,
  }),
}));

const NOW = '2026-10-07T15:00:00.000Z';

function member(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: 'ana',
    name: 'Ana Pérez',
    email: 'ana@parkit.test',
    globalRole: 'user',
    createdAt: NOW,
    memberships: [
      {
        tenantId: CENTRO,
        tenantName: 'Centro',
        role: 'operator',
        createdAt: NOW,
      },
    ],
    ...overrides,
  };
}

const ME = member({
  id: 'me',
  name: 'Dueña',
  email: 'duena@parkit.test',
  memberships: [
    { tenantId: CENTRO, tenantName: 'Centro', role: 'owner', createdAt: NOW },
    { tenantId: NORTE, tenantName: 'Norte', role: 'owner', createdAt: NOW },
  ],
});

type Call = { method: string; path: string; body?: unknown };

function calls(method: string) {
  return http.request.mock.calls
    .map(([call]) => call as Call)
    .filter((call) => call.method === method);
}

describe('PersonalPage', () => {
  let staff: StaffMember[];

  beforeEach(() => {
    vi.clearAllMocks();
    staff = [ME, member()];
    http.request.mockImplementation((call: Call) => {
      if (call.method === 'GET') {
        const url = new URL(call.path, 'http://local');
        const role = url.searchParams.get('role');
        const items = role
          ? staff.filter((m) => m.memberships.some((x) => x.role === role))
          : staff;
        return Promise.resolve({
          items,
          total: items.length,
          page: 1,
          pageSize: 10,
        });
      }
      if (call.method === 'POST') {
        return Promise.resolve({
          email: 'nuevo@parkit.test',
          name: null,
          tenantName: 'Centro',
          role: 'operator',
        });
      }
      return Promise.resolve({ tenantName: 'Centro', name: 'Ana Pérez' });
    });
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista al personal de la sucursal activa', async () => {
    await mount(<PersonalPage />);

    expect(pageText()).toContain('2 personas en Centro');
    expect(pageText()).toContain('Ana Pérez');
    expect(calls('GET')[0].path).toContain(`tenantId=${CENTRO}`);
  });

  it('filtra por rol', async () => {
    await mount(<PersonalPage />);

    await change(field<HTMLSelectElement>('Filtrar por rol'), 'owner');

    expect(calls('GET').at(-1)!.path).toContain('role=owner');
  });

  it('agrega una persona por email', async () => {
    await mount(<PersonalPage />);

    await click('Agregar persona');
    await change(field('Email'), 'nuevo@parkit.test');
    await click('Agregar');

    expect(calls('POST')[0]).toMatchObject({
      path: `/tenants/${CENTRO}/staff`,
      body: { email: 'nuevo@parkit.test', role: 'operator' },
    });
    expect(pageText()).toContain('nuevo@parkit.test ahora trabaja en Centro.');
  });

  it('avisa debajo del email si la persona no tiene cuenta', async () => {
    http.request.mockImplementation((call: Call) =>
      call.method === 'POST'
        ? Promise.reject(
            new ApiError(404, 'Not Found', { code: 'USER_NOT_FOUND' } as never),
          )
        : Promise.resolve({ items: staff, total: 2, page: 1, pageSize: 10 }),
    );
    await mount(<PersonalPage />);

    await click('Agregar persona');
    await change(field('Email'), 'nadie@parkit.test');
    await click('Agregar');

    expect(pageText()).toContain(
      'No hay ninguna cuenta registrada con ese mail.',
    );
    expect(calls('POST')).toHaveLength(1);
  });

  it('cambia el rol, suma a otra sucursal y saca a una persona', async () => {
    await mount(<PersonalPage />);

    await click('Gestionar a Ana Pérez');
    await change(field<HTMLSelectElement>('Rol en Centro'), 'owner');
    expect(calls('PATCH')[0]).toMatchObject({
      path: `/tenants/${CENTRO}/staff/ana`,
      body: { role: 'owner' },
    });

    await change(field<HTMLSelectElement>('Sucursal a agregar'), NORTE);
    await click('Sumar');
    expect(calls('POST')[0]).toMatchObject({
      path: `/tenants/${NORTE}/staff`,
      body: { email: 'ana@parkit.test' },
    });

    await click('Sacar');
    await click('Sí, sacar');
    expect(calls('DELETE')[0].path).toBe(`/tenants/${CENTRO}/staff/ana`);
  });

  it('avisa si no se pudo cargar', async () => {
    http.request.mockRejectedValue(new ApiError(500, 'boom', null));
    await mount(<PersonalPage />);

    expect(pageText()).toContain('No se pudo cargar el personal');
  });
});
