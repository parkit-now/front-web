import { ApiError } from './client';

/**
 * ¿El backend rechazó la sesión con la que se hizo esta llamada?
 *
 * Es la única pregunta que separa "esta sesión no sirve más, mandá al login" de
 * "el servidor tuvo un problema, no toques la sesión". Vive en su propio módulo
 * y no adentro de un `catch` porque de esa distinción dependen dos efectos
 * opuestos e irreversibles desde el punto de vista del usuario: desloguearlo o
 * dejarlo adentro.
 *
 * OJO con lo que NO es un 401 acá:
 *
 *  - **403** es "tu sesión vale, pero no te da el rol". Desloguear ahí sería
 *    mentirle al usuario y hacerle perder el trabajo en pantalla.
 *  - **500 / 502 / 504** son problemas del servidor. La sesión sigue siendo
 *    válida y va a servir apenas el backend vuelva.
 *  - **`TypeError`** es `fetch()` sin red. Es el más peligroso de confundir: si
 *    lo tratáramos como sesión muerta, cada corte de wifi desloguearía al
 *    dueño.
 */
export function isSessionRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
