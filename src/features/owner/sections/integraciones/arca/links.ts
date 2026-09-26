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

/**
 * Administrador de Relaciones de Clave Fiscal: desde acá se adhieren los
 * servicios (WSASS, Administración de Certificados Digitales) y se asocian
 * los web services al certificado en producción. Con la sesión del portal
 * abierta entra directo (lo verificó el usuario navegando ARCA); sin sesión,
 * ARCA pide el login. Si ARCA la cambia, se ajusta acá.
 */
export const ARCA_ADMIN_RELACIONES_URL =
  'https://serviciosweb.afip.gob.ar/claveFiscal/adminRel/main.aspx';

/**
 * Contacto de soporte para cuando "Verificar" sigue fallando después de
 * revisar los pasos marcados. HOY es `null` a propósito: Parkit todavía no
 * tiene un canal de soporte para el dueño — el usuario lo va a definir más
 * adelante. Quien lo consuma (`Step2Upload`, sub-paso 6) ya sabe mostrar el
 * aviso como texto plano ("contactá a soporte") mientras sea `null`, y como
 * link cuando se complete con `{ label, href }`.
 */
export const SUPPORT_CONTACT: { label: string; href: string } | null = null;
