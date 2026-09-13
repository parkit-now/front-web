import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api/client';
import { mapSubmitError, readAddressField } from './errors';

/** El 422 REAL del backend, copiado de la respuesta local. */
function notSubmittable(fields: string[]): ApiError {
  return new ApiError(422, 'Unprocessable Entity', {
    title: 'Unprocessable Entity',
    status: 422,
    detail:
      'The application cannot be submitted for review without the parking lot address',
    instance: '/onboarding/applications/x/submit',
    code: 'ONBOARDING_NOT_SUBMITTABLE',
    validationsErrors: fields.map((field) => ({
      field,
      reason: `${field} is required to submit the application for review`,
      code: 'isNotEmpty',
    })),
  });
}

describe('readAddressField', () => {
  it('se queda con la hoja del path del backend', () => {
    expect(readAddressField('declaredEntity.location.cityName')).toBe(
      'cityName',
    );
    expect(readAddressField('streetName')).toBe('streetName');
  });

  it('ignora lo que no sea un campo de la dirección', () => {
    expect(readAddressField('declaredEntity.cuit')).toBeNull();
    expect(readAddressField('')).toBeNull();
    // Un campo nuevo que agregue el backend mañana NO inventa una etiqueta.
    expect(readAddressField('declaredEntity.location.county')).toBeNull();
  });
});

describe('mapSubmitError', () => {
  // El caso real: borrador viejo con sólo el `address` de texto plano.
  it('nombra los cuatro campos que faltan', () => {
    const message = mapSubmitError(
      notSubmittable([
        'declaredEntity.location.streetName',
        'declaredEntity.location.streetNumber',
        'declaredEntity.location.cityName',
        'declaredEntity.location.stateName',
      ]),
    );
    expect(message).toBe(
      'Ingresá el domicilio del estacionamiento: falta la calle, la altura, la localidad y la provincia',
    );
  });

  it('con uno solo no arma una lista', () => {
    expect(
      mapSubmitError(notSubmittable(['declaredEntity.location.streetNumber'])),
    ).toBe('Ingresá el domicilio del estacionamiento: falta la altura');
  });

  // Leer "falta la localidad, la calle y la altura" obliga a reordenar
  // mentalmente lo que en pantalla ya está ordenado.
  it('respeta el orden del formulario, no el del backend', () => {
    const message = mapSubmitError(
      notSubmittable([
        'declaredEntity.location.stateName',
        'declaredEntity.location.streetName',
      ]),
    );
    expect(message).toBe(
      'Ingresá el domicilio del estacionamiento: falta la calle y la provincia',
    );
  });

  // Sin `validationsErrors` utilizables cae al catálogo por `code`, que YA
  // tenía traducido `ONBOARDING_NOT_SUBMITTABLE`. Nunca el `detail` en inglés.
  it('sin campos de dirección usa el mensaje del catálogo por code', () => {
    const message = mapSubmitError(notSubmittable(['declaredEntity.cuit']));
    expect(message).toBe(
      'Completá los datos requeridos antes de enviar la solicitud.',
    );
    expect(message).not.toContain('cannot be submitted');
  });

  it('otro código del backend sigue traducido por el catálogo', () => {
    const error = new ApiError(409, 'Conflict', {
      status: 409,
      code: 'ONBOARDING_INVALID_STATE',
    } as never);
    expect(mapSubmitError(error)).toBe(
      'La solicitud no se puede modificar en su estado actual.',
    );
  });

  it('un error que no es ApiError no rompe ni filtra texto crudo', () => {
    expect(mapSubmitError(new Error('boom'))).toBe(
      'Ocurrió un error inesperado.',
    );
  });
});
