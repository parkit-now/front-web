// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/client';
import {
  change,
  click,
  mount,
  pageText,
  unmountAll,
} from '../../../../test/dom';
import type {
  ApplicationDetail,
  ApplicationSummary,
} from '../../services/applications';
import { SolicitudesPage } from './SolicitudesPage';

const api = vi.hoisted(() => ({
  listApplications: vi.fn(),
  getApplicationDetail: vi.fn(),
  getDocumentSignedUrl: vi.fn(),
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
}));

vi.mock('../../services/applications', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...api,
}));

const NOW = '2026-10-07T15:00:00.000Z';

function summary(
  overrides: Partial<ApplicationSummary> = {},
): ApplicationSummary {
  return {
    id: 'app-1',
    name: 'Playa Once',
    legalName: 'Once SRL',
    cuit: '20123456786',
    email: 'once@parkit.test',
    applicantEmail: 'duenio@parkit.test',
    docsCount: 2,
    status: 'pending',
    createdAt: NOW,
    submittedAt: NOW,
    ...overrides,
  };
}

function detail(overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    ...summary(),
    address: 'Bartolomé Mitre 2500, CABA',
    phone: '+5491122334455',
    totalSpots: 40,
    tenantId: null,
    reviewedAt: null,
    rejectionReason: null,
    declaredEntity: { name: 'Playa Once', totalSpots: 40 },
    schedules: [{ day: 'monday', openMinute: 480, closeMinute: 1200 }],
    location: {
      formatted: 'Bartolomé Mitre 2500, CABA',
      streetName: 'Bartolomé Mitre',
      streetNumber: '2500',
      floor: null,
      cityName: 'CABA',
      stateName: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1039',
      latitude: -34.6,
      longitude: -58.4,
      geocodedAt: NOW,
      geocodingSource: 'georef',
    },
    documents: [
      {
        id: 'doc-1',
        name: 'habilitacion.pdf',
        mimeType: 'application/pdf',
        storagePath: 'a/b.pdf',
        createdAt: NOW,
      },
      {
        id: 'doc-2',
        name: 'frente.jpg',
        mimeType: 'image/jpeg',
        storagePath: 'a/c.jpg',
        createdAt: NOW,
      },
    ],
    ...overrides,
  };
}

describe('SolicitudesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listApplications.mockResolvedValue([
      summary(),
      summary({ id: 'app-2', name: 'Playa Norte', docsCount: 0 }),
    ]);
    api.getApplicationDetail.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'app-2'
          ? detail({ id: 'app-2', name: 'Playa Norte', documents: [] })
          : detail(),
      ),
    );
    api.getDocumentSignedUrl.mockResolvedValue({
      url: 'https://storage.test/doc',
      expiresIn: 300,
    });
    api.approveApplication.mockResolvedValue(summary({ status: 'approved' }));
    api.rejectApplication.mockResolvedValue(summary({ status: 'rejected' }));
  });

  afterEach(async () => {
    await unmountAll();
  });

  it('lista las solicitudes pendientes y abre la primera', async () => {
    await mount(<SolicitudesPage />);

    expect(pageText()).toContain('Solicitudes');
    expect(pageText()).toContain('Playa Norte');
    expect(pageText()).toContain('habilitacion.pdf');
    expect(api.listApplications).toHaveBeenCalledWith('pending');
    expect(api.getApplicationDetail).toHaveBeenCalledWith('app-1');
  });

  it('cambia de solicitud', async () => {
    await mount(<SolicitudesPage />);

    const item = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Playa Norte'),
    )!;
    await click(item);

    expect(api.getApplicationDetail).toHaveBeenCalledWith('app-2');
  });

  it('aprueba el alta', async () => {
    await mount(<SolicitudesPage />);

    await click('Aprobar alta');
    expect(pageText()).toContain('Se va a crear el estacionamiento');
    const buttons = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Aprobar alta',
    );
    await click(buttons[buttons.length - 1]);

    expect(api.approveApplication).toHaveBeenCalledWith('app-1');
    expect(pageText()).toContain('Alta aprobada correctamente.');
  });

  it('rechaza con motivo', async () => {
    await mount(<SolicitudesPage />);

    await click('Rechazar');
    await change(
      document.querySelector<HTMLTextAreaElement>('#reject-reason')!,
      'La dirección no existe.',
    );
    const buttons = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Rechazar',
    );
    await click(buttons[buttons.length - 1]);

    expect(api.rejectApplication).toHaveBeenCalledWith(
      'app-1',
      'La dirección no existe.',
    );
    expect(pageText()).toContain('Solicitud rechazada.');
  });

  it('previsualiza un documento', async () => {
    await mount(<SolicitudesPage />);

    await click('Previsualizar habilitacion.pdf');

    expect(api.getDocumentSignedUrl).toHaveBeenCalledWith(
      'app-1',
      'doc-1',
      'inline',
    );
    expect(document.querySelector('iframe')).toBeTruthy();
  });

  it('descarga un documento y avisa si falla', async () => {
    await mount(<SolicitudesPage />);

    await click('Descargar frente.jpg');
    expect(api.getDocumentSignedUrl).toHaveBeenCalledWith(
      'app-1',
      'doc-2',
      'attachment',
    );

    api.getDocumentSignedUrl.mockRejectedValue(new ApiError(500, 'x', null));
    await click('Descargar frente.jpg');
    expect(document.querySelector('.toast-error')).toBeTruthy();
  });

  it('muestra el estado vacío', async () => {
    api.listApplications.mockResolvedValue([]);
    await mount(<SolicitudesPage />);

    expect(pageText()).toContain('No quedan solicitudes pendientes');
    expect(api.getApplicationDetail).not.toHaveBeenCalled();
  });
});
