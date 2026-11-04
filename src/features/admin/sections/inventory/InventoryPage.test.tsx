// @vitest-environment happy-dom
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  change,
  click,
  field,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type { Parking } from '../../services/parkings';
import { InventoryPage } from './InventoryPage';

const api = vi.hoisted(() => ({
  listParkings: vi.fn(),
  createParking: vi.fn(),
  updateParking: vi.fn(),
  getDeletionPreflight: vi.fn(),
  deleteParking: vi.fn(),
  restoreParking: vi.fn(),
}));

vi.mock('../../services/parkings', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...api,
}));
vi.mock('../../../../lib/supabase/useCurrentUserId', () => ({
  useCurrentUserId: () => 'admin-1',
}));
vi.mock('../../../../shared/components/AddressPicker/AddressMap', () => ({
  AddressMap: () => null,
}));
vi.mock('../../../../lib/geocoding/georef', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  georefProvider: {
    id: 'georef',
    search: () => Promise.resolve({ status: 'empty', results: [] }),
  },
}));

const NOW = '2026-10-07T15:00:00.000Z';

function parking(overrides: Partial<Parking> = {}): Parking {
  return {
    id: 'p-1',
    name: 'Playa Once',
    address: 'Bartolomé Mitre 2500',
    email: 'once@parkit.test',
    phone: null,
    cuit: null,
    legalName: null,
    status: 'active',
    createdAt: NOW,
    deletedAt: null,
    purgeAfter: null,
    location: {
      formatted: 'Bartolomé Mitre 2500',
      streetName: 'Bartolomé Mitre',
      streetNumber: '2500',
      floor: null,
      cityName: 'CABA',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      postalCode: null,
      latitude: null,
      longitude: null,
      geocodedAt: null,
      geocodingSource: 'manual',
    },
    ...overrides,
  };
}

function Path() {
  return <output data-path>{useLocation().pathname}</output>;
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.listParkings.mockResolvedValue({
      items: [
        parking(),
        parking({
          id: 'p-2',
          name: 'Playa Vieja',
          deletedAt: NOW,
          purgeAfter: '2026-11-07T15:00:00.000Z',
        }),
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    api.createParking.mockResolvedValue(parking({ id: 'p-3' }));
    api.updateParking.mockResolvedValue(parking());
    api.getDeletionPreflight.mockResolvedValue({
      tenantId: 'p-1',
      name: 'Playa Once',
      blockers: [],
      carsInside: 0,
      openCashSessions: 0,
      cashSessions: 3,
      entries: 120,
      invoices: 10,
      reservations: 2,
      staff: 2,
      auditRows: 50,
      storageObjects: 4,
      arcaLinked: false,
      mercadoPagoLinked: true,
    });
    api.deleteParking.mockResolvedValue({
      parking: parking({ deletedAt: NOW }),
      effects: [],
    });
    api.restoreParking.mockResolvedValue(parking({ id: 'p-2' }));
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista los estacionamientos', async () => {
    await mount(<InventoryPage />);

    expect(pageText()).toContain('Estacionamientos');
    expect(pageText()).toContain('Playa Once');
  });

  it('crea un estacionamiento', async () => {
    await mount(<InventoryPage />);

    await click('Nuevo estacionamiento');
    await click('Crear');
    expect(pageText()).toContain('Ingresá el nombre del estacionamiento.');

    await change(field('Nombre *'), 'Playa Sur');
    await click('Crear');

    expect(api.createParking).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Playa Sur' }),
    );
    expect(pageText()).toContain('Estacionamiento creado.');
  });

  it('edita un estacionamiento', async () => {
    await mount(<InventoryPage />);

    await click('Editar Playa Once');
    await change(field('Razón social'), 'Once SRL');
    await click('Guardar cambios');

    expect(api.updateParking).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ legalName: 'Once SRL' }),
    );
  });

  it('da de baja escribiendo el nombre para confirmar', async () => {
    await mount(<InventoryPage />);

    await click('Dar de baja Playa Once');
    expect(api.getDeletionPreflight).toHaveBeenCalledWith('p-1');
    await change(field('Escribí «Playa Once» para confirmar'), 'Playa Once');
    const buttons = [...document.querySelectorAll('button')].filter((b) =>
      b.textContent?.trim().startsWith('Dar de baja'),
    );
    await click(buttons[buttons.length - 1]);

    expect(api.deleteParking).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ confirmName: 'Playa Once' }),
    );
    expect(pageText()).toContain('Estacionamiento dado de baja.');
  });

  it('muestra los eliminados y los restaura', async () => {
    await mount(<InventoryPage />);

    await click(field('Mostrar eliminados'));
    await click('Restaurar Playa Vieja');

    expect(api.restoreParking).toHaveBeenCalledWith('p-2');
  });

  it('abre el panel de un estacionamiento', async () => {
    await mount(
      <>
        <InventoryPage />
        <Path />
      </>,
    );

    await click('Ver panel de Playa Once');

    expect(document.querySelector('[data-path]')!.textContent).toBe(
      '/ops/estacionamientos/p-1/estadisticas',
    );
  });
});
