/**
 * URL de login del portal de ARCA.
 *
 * Los servicios que usa el wizard (WSASS, Administración de Certificados
 * Digitales, Administrador de Relaciones de Clave Fiscal, Administración de
 * puntos de venta y domicilios...) no tienen una URL propia que se pueda
 * linkear directo: todos exigen la sesión SSO del portal, y entrar por la URL
 * interna de un servicio sin haberte logueado antes te devuelve a este mismo
 * login. Por eso cada "Entrar a ARCA" del wizard apunta siempre acá: el dueño
 * inicia sesión con su clave fiscal y navega a mano al servicio que le
 * pedimos en cada paso.
 */
export const ARCA_LOGIN_URL =
  'https://auth.afip.gob.ar/contribuyente_/login.xhtml';
