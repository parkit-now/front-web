// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  change,
  click,
  mount,
  pageText,
  settle,
  unmountAll,
} from '../../../../test/dom';
import type { AdminUser, AdminUserDetail } from '../../services/users';
import { UsuariosPage } from './UsuariosPage';

const users = vi.hoisted(() => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  updateUserRole: vi.fn(),
  deleteUser: vi.fn(),
  addMembership: vi.fn(),
  updateMembership: vi.fn(),
  removeMembership: vi.fn(),
}));
const parkings = vi.hoisted(() => ({ listParkings: vi.fn() }));

vi.mock('../../services/users', () => users);
vi.mock('../../services/parkings', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...parkings,
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'admin-1',
}));

const NOW = '2026-10-07T15:00:00.000Z';

const ana: AdminUser = {
  id: 'ana',
  name: 'Ana Pérez',
  email: 'ana@parkit.test',
  role: 'user',
  createdAt: NOW,
};

function detail(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    ...ana,
    memberships: [
      {
        parkingId: 'p-1',
        parkingName: 'Playa Once',
        role: 'operator',
        createdAt: NOW,
        parkingDeletedAt: null,
      },
    ],
    ...overrides,
  };
}

/** El confirm del diálogo es el último botón con ese texto. */
async function confirm(label: string) {
  const buttons = [...document.querySelectorAll('button')].filter(
    (b) => b.textContent?.trim() === label,
  );
  await click(buttons[buttons.length - 1]);
}

describe('UsuariosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    users.listUsers.mockResolvedValue({
      items: [
        ana,
        {
          id: 'admin-1',
          name: null,
          email: 'admin@parkit.test',
          role: 'admin',
          createdAt: NOW,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    users.getUser.mockResolvedValue(detail());
    users.updateUserRole.mockResolvedValue({ ...ana, role: 'admin' });
    users.deleteUser.mockResolvedValue(undefined);
    users.addMembership.mockResolvedValue({});
    users.updateMembership.mockResolvedValue({});
    users.removeMembership.mockResolvedValue(undefined);
    parkings.listParkings.mockResolvedValue({
      items: [
        {
          id: 'p-2',
          name: 'Playa Norte',
          address: 'Cabildo 2000',
          status: 'active',
          deletedAt: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista los usuarios', async () => {
    await mount(<UsuariosPage />);

    expect(pageText()).toContain('Ana Pérez');
    expect(pageText()).toContain('admin@parkit.test');
  });

  it('abre el detalle con sus estacionamientos', async () => {
    await mount(<UsuariosPage />);

    await click('Editar roles de Ana Pérez');

    expect(pageText()).toContain('Detalle de usuario');
    expect(pageText()).toContain('Playa Once');
    expect(users.getUser).toHaveBeenCalledWith('ana');
  });

  it('asciende a administrador después de confirmar', async () => {
    await mount(<UsuariosPage />);

    await click('Editar roles de Ana Pérez');
    await click('Ascender a administrador');
    await confirm('Ascender');

    expect(users.updateUserRole).toHaveBeenCalledWith('ana', 'admin');
    expect(pageText()).toContain('Rol actualizado.');
  });

  it('cambia el rol de una relación y la quita', async () => {
    await mount(<UsuariosPage />);

    await click('Editar roles de Ana Pérez');
    await click('Pasar a dueño');
    await confirm('Pasar a dueño');
    expect(users.updateMembership).toHaveBeenCalledWith(
      'ana',
      'p-1',
      expect.objectContaining({ role: 'owner' }),
    );

    await click('Quitar');
    await confirm('Quitar');
    expect(users.removeMembership).toHaveBeenCalledWith('ana', 'p-1');
  });

  it('asigna un estacionamiento buscándolo', async () => {
    await mount(<UsuariosPage />);

    await click('Editar roles de Ana Pérez');
    const search = document.querySelector<HTMLInputElement>(
      'input[placeholder="Buscar estacionamiento…"]',
    )!;
    await act(() => {
      search.focus();
      return Promise.resolve();
    });
    await change(search, 'Norte');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    const option = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Playa Norte'),
    )!;
    await act(() => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return Promise.resolve();
    });
    await settle();
    await click('Dueño');
    await confirm('Asignar como dueño');

    expect(users.addMembership).toHaveBeenCalledWith(
      'ana',
      expect.objectContaining({ parkingId: 'p-2', role: 'owner' }),
    );
  });

  it('elimina al usuario', async () => {
    await mount(<UsuariosPage />);

    await click('Editar roles de Ana Pérez');
    await click('Eliminar usuario');
    await confirm('Eliminar');

    expect(users.deleteUser).toHaveBeenCalledWith('ana');
    expect(pageText()).toContain('Usuario eliminado.');
  });
});
