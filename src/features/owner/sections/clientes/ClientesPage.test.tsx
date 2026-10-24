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
import type { Client } from '../../services/clients';
import { ClientesPage } from './ClientesPage';

const clients = vi.hoisted(() => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));
const invoices = vi.hoisted(() => ({ lookupTaxpayer: vi.fn() }));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user',
}));
vi.mock('../../services/clients', () => clients);
vi.mock('../../services/invoices', () => invoices);

const NOW = '2026-10-07T15:00:00.000Z';
const CUIT = '20123456781';

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: 'ana',
    name: 'Ana Pérez',
    plates: ['AB123CD'],
    cuit: null,
    email: 'ana@parkit.test',
    phone: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    tenantId: 'tenant',
    version: 1,
    syncSeq: 1,
    ...overrides,
  };
}

function modal() {
  return document.querySelector('.client-form')!;
}

describe('ClientesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sucursal.role = 'owner';
    clients.listClients.mockResolvedValue([
      client(),
      client({ id: 'beto', name: null, plates: ['XYZ999'], email: null }),
    ]);
    clients.createClient.mockResolvedValue(client({ id: 'nuevo' }));
    clients.updateClient.mockResolvedValue(client());
    clients.deleteClient.mockResolvedValue(undefined);
    invoices.lookupTaxpayer.mockResolvedValue({
      identified: true,
      razonSocial: 'ACME SA',
    });
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('sólo el dueño ve los clientes', async () => {
    sucursal.role = 'operator';
    await mount(<ClientesPage />);

    expect(pageText()).toBe('');
  });

  it('lista los clientes', async () => {
    await mount(<ClientesPage />);

    expect(pageText()).toContain('Ana Pérez');
    expect(pageText()).toContain('XYZ999');
    expect(clients.listClients).toHaveBeenCalledWith('tenant');
  });

  it('agrega un cliente con dos patentes', async () => {
    await mount(<ClientesPage />);

    await click('Agregar cliente');
    await change(field('Patente 1'), 'ac-456-de');
    await click('Agregar patente');
    await change(field('Patente 2'), 'AD789EF');
    await change(field('Nombre (opcional)'), 'Carla');
    await click('Guardar');

    expect(clients.createClient).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({
        plates: ['AC456DE', 'AD789EF'],
        name: 'Carla',
        movePlates: false,
      }),
    );
  });

  it('valida patentes, CUIT y email antes de guardar', async () => {
    await mount(<ClientesPage />);

    await click('Agregar cliente');
    await click('Guardar');
    expect(pageText()).toContain('Ingresá una o más patentes válidas');

    await change(field('Patente 1'), 'AC456DE');
    await change(field('CUIT (opcional)'), '20123456789');
    await click('Guardar');
    expect(pageText()).toContain('Ingresá un CUIT válido.');

    await change(field('CUIT (opcional)'), '');
    await change(field('Email (opcional)'), 'no-es-mail');
    await click('Guardar');
    expect(pageText()).toContain('Ingresá un email válido.');
    expect(clients.createClient).not.toHaveBeenCalled();
  });

  it('completa la razón social a partir del CUIT', async () => {
    await mount(<ClientesPage />);

    await click('Agregar cliente');
    const cuit = field('CUIT (opcional)');
    await change(cuit, CUIT);
    await act(() => {
      cuit.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      return Promise.resolve();
    });
    await settle();

    expect(invoices.lookupTaxpayer).toHaveBeenCalledWith('tenant', CUIT);
    expect(field('Nombre (opcional)').value).toBe('ACME SA');
  });

  it('pregunta antes de mover una patente de otro cliente', async () => {
    await mount(<ClientesPage />);

    await click('Agregar cliente');
    await change(field('Patente 1'), 'XYZ999');
    await click('Guardar');
    expect(pageText()).toContain('ya pertenecen a otro cliente');
    await click('Mover y guardar');

    expect(clients.createClient).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ plates: ['XYZ999'], movePlates: true }),
    );
  });

  it('edita un cliente y quita una patente', async () => {
    clients.listClients.mockResolvedValue([
      client({ plates: ['AB123CD', 'AA111BB'] }),
    ]);
    await mount(<ClientesPage />);

    await click('Editar Ana Pérez');
    expect(modal()).toBeTruthy();
    await click('Quitar patente 2');
    await click('Guardar');

    expect(clients.updateClient).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ id: 'ana' }),
      expect.objectContaining({ plates: ['AB123CD'] }),
    );
  });

  it('elimina un cliente y muestra el error si falla', async () => {
    clients.deleteClient.mockRejectedValue(new ApiError(500, 'boom', null));
    await mount(<ClientesPage />);

    await click('Eliminar XYZ999');
    await click('Eliminar');

    expect(clients.deleteClient).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ id: 'beto' }),
    );
    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('avisa si no se pudieron cargar', async () => {
    clients.listClients.mockRejectedValue(new Error('offline'));
    await mount(<ClientesPage />);

    expect(pageText()).toContain('No pudimos cargar los clientes.');
  });
});
