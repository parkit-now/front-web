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
import type { EntityProfile } from '../../services/entities';
import { ConfigPerfil } from './ConfigPerfil';
import { ConfigRetencion } from './ConfigRetencion';

const entities = vi.hoisted(() => ({
  getEntityProfile: vi.fn(),
  updateEntityProfile: vi.fn(),
}));
const sucursal = vi.hoisted(() => ({ role: 'owner' }));

vi.mock('../../context/SucursalContext', () => ({
  useSucursal: () => ({
    sucursalId: 'tenant',
    sucursal: { nombre: 'APEX', role: sucursal.role },
  }),
}));
vi.mock('../../services/entities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...entities,
}));
// Leaflet no dibuja en happy-dom.
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

function profile(overrides: Partial<EntityProfile> = {}): EntityProfile {
  return {
    id: 'tenant',
    name: 'APEX',
    legalName: 'APEX SRL',
    cuit: '20123456781',
    email: 'apex@parkit.test',
    phone: '+5491122334455',
    status: 'active',
    address: 'Av. Corrientes 1234, CABA',
    capacity: { total: 40 },
    location: {
      formatted: 'Av. Corrientes 1234, CABA',
      streetName: 'Av. Corrientes',
      streetNumber: '1234',
      floor: null,
      cityName: 'Ciudad Autónoma de Buenos Aires',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1043',
      latitude: -34.6037,
      longitude: -58.3816,
      geocodedAt: NOW,
      geocodingSource: 'georef',
    },
    lprImageRetentionDays: 30,
    paymentMethods: [],
    createdAt: NOW,
    desktopCameraConfig: null,
    entryCameraId: null,
    entryCameraLabel: null,
    ticketTemplate: null,
    ...overrides,
  };
}

describe('ConfigPerfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sucursal.role = 'owner';
    entities.getEntityProfile.mockResolvedValue(profile());
    entities.updateEntityProfile.mockResolvedValue(profile());
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('carga los datos del estacionamiento en el formulario', async () => {
    await mount(<ConfigPerfil />);

    expect(field('Nombre').value).toBe('APEX');
    expect(field('Razón social').value).toBe('APEX SRL');
    expect(field('Capacidad total (plazas)').value).toBe('40');
  });

  it('guarda los cambios', async () => {
    await mount(<ConfigPerfil />);

    await change(field('Nombre'), 'APEX Centro');
    await change(field('Capacidad total (plazas)'), '55');
    await click('Guardar cambios');

    expect(entities.updateEntityProfile).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({
        name: 'APEX Centro',
        capacity: { total: 55 },
      }),
    );
    expect(pageText()).toContain('Estacionamiento actualizado correctamente.');
  });

  it('valida la capacidad y el teléfono antes de guardar', async () => {
    await mount(<ConfigPerfil />);

    await change(field('Capacidad total (plazas)'), '-3');
    await click('Guardar cambios');
    expect(entities.updateEntityProfile).not.toHaveBeenCalled();

    await change(field('Capacidad total (plazas)'), '40');
    const phone =
      document.querySelector<HTMLInputElement>('input[type="tel"]')!;
    await change(phone, '12');
    await click('Guardar cambios');
    expect(entities.updateEntityProfile).not.toHaveBeenCalled();
  });

  it('muestra el error del backend', async () => {
    entities.updateEntityProfile.mockRejectedValue(
      new ApiError(500, 'boom', null),
    );
    await mount(<ConfigPerfil />);

    await click('Guardar cambios');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('cambia el estado a mantenimiento', async () => {
    await mount(<ConfigPerfil />);

    const status = document.querySelector<HTMLSelectElement>('select')!;
    await change(status, 'maintenance');
    await click('Guardar cambios');

    expect(entities.updateEntityProfile).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ status: 'maintenance' }),
    );
  });
});

describe('ConfigRetencion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sucursal.role = 'owner';
    entities.getEntityProfile.mockResolvedValue(profile());
    entities.updateEntityProfile.mockResolvedValue(profile());
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('cambia los días de retención', async () => {
    await mount(<ConfigRetencion />);

    await change(
      field<HTMLSelectElement>('Días de retención (eventos registrados)'),
      '90',
    );
    await click('Guardar cambios');

    expect(entities.updateEntityProfile).toHaveBeenCalledWith('tenant', {
      lprImageRetentionDays: 90,
    });
    expect(pageText()).toContain('Política de retención actualizada.');
  });

  it('avisa si falla', async () => {
    entities.updateEntityProfile.mockRejectedValue(
      new ApiError(500, 'boom', null),
    );
    await mount(<ConfigRetencion />);

    await change(
      field<HTMLSelectElement>('Días de retención (eventos registrados)'),
      '60',
    );
    await click('Guardar cambios');

    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('sin permisos de dueño no se puede cambiar', async () => {
    sucursal.role = 'operator';
    await mount(<ConfigRetencion />);

    expect(
      field<HTMLSelectElement>('Días de retención (eventos registrados)')
        .disabled,
    ).toBe(true);
    expect(pageText()).not.toContain('Guardar cambios');
  });
});
