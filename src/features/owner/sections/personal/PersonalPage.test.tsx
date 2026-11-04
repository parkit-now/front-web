// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  change,
  click,
  field,
  mount,
  pageText,
  settle,
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
        let items = role
          ? staff.filter((m) => m.memberships.some((x) => x.role === role))
          : staff;
        const search = url.searchParams.get('search')?.trim().toLowerCase();
        const searchField = url.searchParams.get('searchField');
        if (search)
          items = items.filter((item) => {
            const values =
              searchField === 'name'
                ? [item.name]
                : searchField === 'email'
                  ? [item.email]
                  : [item.name, item.email];
            return values.some((value) =>
              value?.toLowerCase().includes(search),
            );
          });
        const page = Number(url.searchParams.get('page') ?? 1);
        const pageSize = Number(url.searchParams.get('pageSize') ?? 10);
        return Promise.resolve({
          items: items.slice((page - 1) * pageSize, page * pageSize),
          total: items.length,
          page,
          pageSize,
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

  it('busca Nombre o Email en el servidor, vuelve a la primera página y conserva el total correcto', async () => {
    staff = [
      ...Array.from({ length: 11 }, (_, index) =>
        member({
          id: `other-${index}`,
          name: `Persona ${index}`,
          email: `persona${index}@parkit.test`,
        }),
      ),
      member({ id: 'name', name: 'Ana Pérez', email: 'otro@parkit.test' }),
      member({ id: 'email', name: 'Carla Gómez', email: 'ana@parkit.test' }),
    ];
    const { container } = await mount(<PersonalPage />);
    await click('Siguiente');
    expect(calls('GET').at(-1)!.path).toContain('page=2');
    await change(field('Buscar en la tabla'), 'ana');
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
    await settle();
    const rows = () => container.querySelector('tbody')?.textContent;
    expect(rows()).toContain('Ana Pérez');
    expect(rows()).toContain('Carla Gómez');
    await click('Campo de búsqueda');
    await click('Nombre');
    const query = new URL(calls('GET').at(-1)!.path, 'http://local')
      .searchParams;
    expect(query.get('searchField')).toBe('name');
    expect(query.get('search')).toBe('ana');
    expect(query.get('page')).toBe('1');
    expect(query.get('tenantId')).toBe(CENTRO);
    expect(rows()).toContain('Ana Pérez');
    expect(rows()).not.toContain('Carla Gómez');
    expect(
      container.querySelector('.dt-pagination-summary')?.textContent,
    ).toContain('de 1');
    await click('Campo de búsqueda');
    await click('Email');
    expect(calls('GET').at(-1)!.path).toContain('searchField=email');
    expect(rows()).toContain('Carla Gómez');
    expect(rows()).not.toContain('Ana Pérez');
    expect(field('Buscar en la tabla').value).toBe('ana');
    await click('Campo de búsqueda');
    await click('Todos');
    expect(calls('GET').at(-1)!.path).not.toContain('searchField=');
    expect(rows()).toContain('Ana Pérez');
    expect(rows()).toContain('Carla Gómez');
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
