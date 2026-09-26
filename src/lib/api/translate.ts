import { ApiError } from './client';

/**
 * Traduce errores del backend a mensajes en español.
 *
 * Precedencia (de mayor a menor especificidad):
 *   1. `problem.code` — identificador estable que define el backend (catálogo
 *      en backend/src/utils/exceptions/error-codes.ts). Es la fuente de verdad.
 *   2. `(endpoint, status)` — fallback cuando el backend no manda code
 *      (clientes viejos o paths no cubiertos).
 *   3. `status` — fallback genérico por HTTP status.
 *   4. Mensaje genérico, nunca el `error.message` crudo (viene en inglés).
 *
 * Para agregar un caso nuevo: pedile al backend el `code` y agregalo al
 * diccionario CODE_MESSAGES. No hacer string matching del `detail`.
 */

export type EndpointKey =
  | 'rates.list'
  | 'rates.create'
  | 'rates.update'
  | 'rates.delete'
  | 'vehicles.list'
  | 'vehicles.create'
  | 'vehicles.update'
  | 'vehicles.delete'
  | 'auth.login'
  | 'auth.register'
  | 'auth.refresh'
  | 'auth.logout'
  | 'auth.forgotPassword'
  | 'auth.resetPassword'
  | 'auth.me'
  | 'onboarding.list'
  | 'onboarding.createApplication'
  | 'onboarding.updateApplication'
  | 'onboarding.addDocument'
  | 'onboarding.submit'
  | 'admin.applications.list'
  | 'admin.applications.detail'
  | 'admin.applications.approve'
  | 'admin.applications.reject'
  | 'admin.applications.document'
  | 'admin.parkings.list'
  | 'admin.parkings.get'
  | 'admin.parkings.create'
  | 'admin.parkings.update'
  | 'admin.parkings.delete'
  | 'admin.users.list'
  | 'admin.users.detail'
  | 'admin.users.updateRole'
  | 'admin.users.delete'
  | 'admin.users.addMembership'
  | 'admin.users.updateMembership'
  | 'admin.users.removeMembership'
  | 'tenants.list'
  | 'entities.profile'
  | 'entities.update'
  | 'entities.payment'
  | 'entities.audit'
  | 'schedules.list'
  | 'schedules.create'
  | 'schedules.update'
  | 'schedules.delete'
  | 'services.list'
  | 'services.toggle'
  | 'metrics.revenue'
  | 'metrics.byPaymentMethod'
  | 'metrics.topPlates'
  | 'metrics.summary'
  | 'cashSessions.list'
  | 'staff.list'
  | 'staff.add'
  | 'staff.update'
  | 'staff.remove'
  | 'audit.list'
  | 'mercadoPago.getAccount'
  | 'mercadoPago.authorizationUrl'
  | 'mercadoPago.oauthCallback'
  | 'mercadoPago.unlink'
  | 'mercadoPago.resyncPos'
  | 'arca.getAccount'
  | 'arca.createAccount'
  | 'arca.updateAccount'
  | 'arca.unlink'
  | 'arca.getCsr'
  | 'arca.uploadCertificate'
  | 'arca.listReusableCertificates'
  | 'arca.reuseCertificate'
  | 'arca.setSalesPoint'
  | 'arca.getRenewalCsr'
  | 'arca.uploadRenewalCertificate'
  | 'invoices.issue'
  | 'invoices.batch'
  | 'invoices.pdf'
  | 'entries.setManuallyInvoiced';

export type TranslateContext = {
  endpoint?: EndpointKey;
};

const GENERIC_MESSAGE = 'Ocurrió un error inesperado.';
const NETWORK_MESSAGE =
  'No pudimos conectarnos con el servidor. Verificá tu conexión.';

// Catalogo estable de `code` provisto por el backend.
// Fuente: backend/src/utils/exceptions/error-codes.ts
const CODE_MESSAGES: Record<string, string> = {
  VEHICLE_NOT_FOUND: 'No encontramos el vehículo.',
  VEHICLE_DUPLICATE: 'Ya tenés un vehículo con esa marca y modelo.',
  // Tipos de vehículo (ABM por estacionamiento)
  VEHICLE_TYPE_NOT_FOUND: 'No encontramos el tipo de vehículo.',
  VEHICLE_TYPE_DUPLICATE: 'Ya tenés un tipo de vehículo con ese nombre.',
  VEHICLE_TYPE_IN_USE:
    'Hay vehículos usando este tipo. Elegí a cuál moverlos antes de eliminarlo.',
  VEHICLE_TYPE_REASSIGN_TARGET_INVALID:
    'El tipo elegido para reasignar no es válido. Actualizá la lista y probá de nuevo.',
  // Auth
  AUTH_INVALID_CREDENTIALS: 'Email o contraseña incorrectos.',
  AUTH_REFRESH_INVALID: 'Tu sesión expiró. Volvé a iniciar sesión.',
  AUTH_MISSING_TOKEN: 'Tu sesión expiró. Volvé a iniciar sesión.',
  AUTH_INVALID_TOKEN: 'Tu sesión expiró. Volvé a iniciar sesión.',
  AUTH_USER_NOT_PROVISIONED:
    'Tu cuenta todavía no está habilitada. Contactá al administrador.',
  AUTH_EMAIL_ALREADY_EXISTS: 'Ya existe una cuenta con ese email.',
  AUTH_WEAK_PASSWORD:
    'La contraseña es demasiado débil. Probá una más larga o variada.',
  AUTH_REGISTER_FAILED:
    'No pudimos crear tu cuenta. Intentalo en unos segundos.',
  AUTH_LOGOUT_FAILED: 'No pudimos cerrar la sesión. Probá de nuevo.',
  AUTH_RESET_TOKEN_INVALID:
    'El link para recuperar tu contraseña venció o ya fue usado. Pedí uno nuevo.',
  AUTH_RESET_PASSWORD_FAILED:
    'No pudimos cambiar tu contraseña. Intentalo en unos segundos.',

  // Onboarding (parking-lot applications)
  ONBOARDING_NOT_SUBMITTABLE:
    'Completá los datos requeridos antes de enviar la solicitud.',
  ONBOARDING_INVALID_STATE:
    'La solicitud no se puede modificar en su estado actual.',
  ONBOARDING_APPLICATION_NOT_FOUND: 'No encontramos la solicitud.',
  ONBOARDING_DOCUMENT_NOT_FOUND: 'No encontramos el documento.',

  // Storage (Supabase)
  STORAGE_SIGNED_URL_FAILED:
    'No pudimos abrir el documento. Intentalo de nuevo.',

  // Admin · estacionamientos (gestión desde el panel Ops).
  PARKING_NOT_FOUND: 'No encontramos el estacionamiento.',

  // Admin · usuarios.
  USER_NOT_FOUND: 'No encontramos el usuario.',
  USER_DELETE_FAILED: 'No pudimos eliminar el usuario. Intentalo de nuevo.',
  MEMBERSHIP_ALREADY_EXISTS:
    'El usuario ya está vinculado a ese estacionamiento.',
  MEMBERSHIP_NOT_FOUND:
    'El usuario no tiene un rol asignado en ese estacionamiento.',

  // Staff · ABM de empleados hecho por el dueño.
  STAFF_SELF_MANAGEMENT:
    'No podés cambiar ni eliminar tu propio rol. Pedíselo a otro dueño.',
  STAFF_LAST_OWNER:
    'Tiene que quedar al menos un dueño en el estacionamiento. Nombrá otro antes de hacer este cambio.',

  // Entidad (tenant) — acceso por membership.
  ENTITY_NOT_FOUND: 'No encontramos el estacionamiento.',
  ENTITY_NOT_OWNER: 'Solo el propietario puede realizar esta acción.',
  ENTITY_NOT_ACTIVE: 'Este estacionamiento todavía no está activo.',
  ENTITY_NO_ACCESS: 'No tenés acceso a este estacionamiento.',
  ENTITY_INSUFFICIENT_ROLE:
    'No tenés permisos suficientes para esta acción en este estacionamiento.',

  // Medios de pago.
  PAYMENT_METHOD_NOT_FOUND: 'No encontramos el medio de pago.',
  PAYMENT_METHOD_SYSTEM_LOCKED:
    'Este es un medio de pago del sistema: podés desactivarlo pero no eliminarlo.',

  // Horarios de atención.
  SCHEDULE_OVERLAP: 'Los horarios no pueden superponerse.',
  SCHEDULE_INVALID_RANGE:
    'La hora de cierre debe ser posterior a la de apertura.',
  SCHEDULE_NOT_FOUND: 'No encontramos el horario.',

  // Servicios del estacionamiento.
  SERVICE_INVALID_CODE: 'El servicio seleccionado no es válido.',
  SERVICE_NOT_FOUND: 'No encontramos el servicio.',

  // Cajas. El mismo code cubre una caja inexistente y una de otra sucursal, a
  // propósito: distinguirlos le confirmaría a un tercero que el id existe.
  CASH_SESSION_NOT_FOUND:
    'La caja seleccionada no existe o no pertenece a este estacionamiento.',

  // Mercado Pago. Le hablamos al dueño de la playa, no a un desarrollador: cada
  // mensaje dice qué pasó y qué hacer. A la `POS` de Mercado Pago le decimos
  // "punto de venta" y no "caja", para no pisarnos con las cajas del turno.
  MP_NOT_LINKED:
    'Todavía no vinculaste tu cuenta de Mercado Pago. Vinculala desde Integraciones para cobrar con QR.',
  MP_ALREADY_LINKED:
    'Este estacionamiento ya tiene una cuenta de Mercado Pago vinculada. Desvinculala antes de conectar otra.',
  MP_ENTITY_ADDRESS_INCOMPLETE:
    'Completá la dirección de tu estacionamiento antes de vincular Mercado Pago.',
  MP_ACCOUNT_TOKEN_EXPIRED:
    'Se venció la conexión con Mercado Pago. Volvé a vincular tu cuenta para seguir cobrando con QR.',
  MP_ACCOUNT_REVOKED:
    'Se revocó el acceso de Parkit a tu cuenta de Mercado Pago. Volvé a vincularla para seguir cobrando con QR.',
  MP_OAUTH_STATE_INVALID:
    'El enlace de vinculación venció o ya se usó. Probá de nuevo desde Integraciones.',
  MP_OAUTH_CODE_EXCHANGE_FAILED:
    'Mercado Pago no pudo confirmar la vinculación. Volvé a intentarlo en unos minutos.',
  MP_STORE_CREATE_FAILED:
    'No pudimos crear la sucursal en Mercado Pago. Volvé a intentarlo en unos minutos.',
  MP_POS_CREATE_FAILED:
    'Vinculamos tu cuenta pero no pudimos crear el punto de venta, así que todavía no hay QR. Probá sincronizarlo desde Integraciones.',
  // La cuenta está vinculada y sana, lo que falta es el punto de venta. La
  // salida es sincronizar, NO volver a vincular: por eso no comparte mensaje
  // con MP_NOT_LINKED.
  MP_POS_NOT_PROVISIONED:
    'Tu cuenta de Mercado Pago está vinculada pero todavía no tiene punto de venta, así que no hay QR. Sincronizalo desde Integraciones.',
  // El backend usa este code para crear, consultar Y cancelar la orden de
  // Mercado Pago, así que el mensaje tiene que servir para los tres casos: no
  // puede decir "no se pudo generar el cobro".
  MP_ORDER_CREATE_FAILED:
    'No pudimos gestionar el cobro con QR en Mercado Pago. Volvé a intentarlo en unos minutos o cobrá por otro medio.',
  MP_UNAVAILABLE:
    'Mercado Pago no está respondiendo. Volvé a intentarlo en unos minutos.',
  // Hermano de MP_UNAVAILABLE: acá directamente no hubo respuesta (timeout,
  // DNS, socket cortado).
  MP_UNREACHABLE:
    'No pudimos comunicarnos con Mercado Pago. Probá de nuevo en un momento.',
  // OJO: esto NO es "el pago falló". Mercado Pago contestó 2xx con un cuerpo
  // que no pudimos interpretar, así que la orden PUEDE EXISTIR igual. El
  // mensaje no puede afirmar que no se cobró: manda a verificar antes de
  // generar otro cobro.
  MP_MALFORMED_RESPONSE:
    'Mercado Pago respondió algo que no pudimos interpretar, así que no sabemos cómo quedó el cobro. Revisalo en Mercado Pago antes de generar otro.',

  // Cobros con QR (intentos de pago). Mismo criterio que el bloque de arriba:
  // le hablamos al operario que tiene al cliente adelante, no a un backend.
  // El mismo code cubre un cobro inexistente y uno de otro estacionamiento, a
  // propósito: distinguirlos le confirmaría a un tercero que el id existe.
  PAYMENT_INTENT_NOT_FOUND:
    'Ese cobro con QR no existe o no pertenece a este estacionamiento.',
  // El bloqueo es de ESTA estadía.
  PAYMENT_INTENT_ALREADY_OPEN:
    'Esta estadía ya tiene un cobro con QR en curso. Usá ese QR o cancelalo antes de generar otro.',
  // El bloqueo es de OTRA estadía: el punto de venta sostiene un cobro por vez.
  // Decir de cuál es el bloqueo no es un detalle: lo que tiene que hacer el
  // operario es distinto que en PAYMENT_INTENT_ALREADY_OPEN.
  PAYMENT_INTENT_POS_BUSY:
    'Hay un cobro con QR en curso para otra estadía. Esperá a que termine o cobrá por otro medio.',
  PAYMENT_INTENT_NOT_CANCELABLE:
    'Ese cobro con QR ya no se puede cancelar: se pagó, venció o ya se había cancelado.',
  PAYMENT_INTENT_ENTRY_CLOSED:
    'Esta estadía ya tiene la salida registrada, así que no se puede cobrar con QR.',
  // Un solo code para cinco casos (ya consumido, de otra estadía, de otra
  // playa, monto distinto, nunca aprobado) porque la salida del operario es la
  // misma en los cinco: mirar cómo quedó el cobro y, si hace falta, generar otro.
  PAYMENT_INTENT_NOT_CONSUMABLE:
    'Ese cobro con QR ya se aplicó o no corresponde a esta estadía. Revisá su estado y, si hace falta, generá uno nuevo.',

  // Facturación electrónica (ARCA). Le hablamos al dueño que está vinculando
  // su CUIT, no a un desarrollador: cada mensaje dice qué pasó en ARCA y qué
  // hacer del lado de Parkit.
  ARCA_NOT_LINKED: 'Esta sede no tiene ARCA vinculada.',
  ARCA_UNAVAILABLE: 'ARCA no responde. Intentalo más tarde.',
  ARCA_CERT_EXPIRED: 'El certificado de ARCA está vencido. Generá uno nuevo.',
  ARCA_ALREADY_LINKED: 'Esta sede ya tiene ARCA vinculada.',
  ARCA_LINK_STEP_INVALID:
    'Ese paso ya no corresponde. Recargá la página para seguir desde donde quedaste.',
  ARCA_CUIT_INVALID: 'El CUIT no es válido.',
  ARCA_CERT_INVALID:
    'El archivo no es un certificado válido de ARCA, o ARCA lo rechazó.',
  ARCA_CERT_CUIT_MISMATCH: 'El certificado es de otro CUIT.',
  ARCA_CERT_KEY_MISMATCH:
    'El certificado no se generó con la solicitud (CSR) de Parkit. Generalo de nuevo con el archivo que descargaste acá.',
  ARCA_CERT_NOT_AUTHORIZED:
    'Falta asociar «Facturación Electrónica» y «Constancia de Inscripción» al certificado en ARCA.',
  ARCA_PADRON_NOT_FOUND: 'ARCA no tiene los datos fiscales de este CUIT.',
  ARCA_POS_NOT_FOUND:
    'El punto de venta no existe en ARCA o no es de web services.',
  ARCA_POS_DISABLED: 'El punto de venta está bloqueado o dado de baja en ARCA.',
  ARCA_FISCAL_DATA_INCOMPLETE:
    'Faltan Ingresos Brutos o la fecha de inicio de actividades: van impresos en la factura.',

  // Facturas emitidas por ARCA a partir de un cobro (ver front-desktop, que es
  // quien las emite). Se traducen acá también porque los errores de la cuenta
  // vinculada (arriba) los puede ver el dueño desde el panel web.
  INVOICE_ALREADY_ISSUED: 'Esta estadía ya tiene una factura emitida.',
  INVOICE_IN_PROGRESS:
    'La factura se está emitiendo en este momento. Esperá unos segundos.',
  INVOICE_REJECTED: 'ARCA rechazó la factura.',
  INVOICE_RECEIVER_REQUIRED:
    'Por el monto, la factura necesita identificar al cliente (CUIT o DNI).',
  INVOICE_NOT_INVOICEABLE:
    'Esta estadía no se puede facturar: sigue abierta o se cobró $0.',
  INVOICE_RECEIVER_NOT_FOUND:
    'ARCA no tiene datos de ese CUIT. Revisalo o emití la factura como B.',
  INVOICE_RECEIVER_NOT_A:
    'Ese CUIT no puede recibir Factura A (no es Responsable Inscripto ni Monotributista). Emitila como B.',
  INVOICE_NOT_ISSUED: 'La factura todavía no se emitió: no tiene PDF.',
  INVOICE_PDF_FAILED: 'No se pudo generar el PDF. Probá de nuevo en un rato.',

  // Validacion (envoltorio — el detalle por campo se traduce con
  // translateValidationCode).
  VALIDATION_FAILED: 'Revisá los datos del formulario.',

  // Genericos por status
  BAD_REQUEST: 'La solicitud tiene datos inválidos.',
  UNAUTHORIZED: 'No tenés autorización para esta acción.',
  FORBIDDEN: 'No tenés permiso para esta acción.',
  NOT_FOUND: 'No encontramos lo que buscabas.',
  CONFLICT: 'Conflicto con el estado actual.',
  UNPROCESSABLE_ENTITY: 'Algunos datos no son válidos.',
  TOO_MANY_REQUESTS: 'Demasiados intentos. Esperá unos segundos.',
  INTERNAL_ERROR: 'El servidor no responde. Intentalo en unos segundos.',
  SERVICE_UNAVAILABLE: 'El servidor no responde. Intentalo en unos segundos.',
  GATEWAY_TIMEOUT: 'El servidor tardó demasiado. Intentalo en unos segundos.',

  // Persistencia
  DB_NOT_FOUND: 'No encontramos lo que buscabas.',
  DB_UNIQUE_CONSTRAINT: 'Ese dato ya está en uso.',
  DB_FOREIGN_KEY_VIOLATION: 'Una referencia obligatoria no es válida.',
  DB_VALIDATION_ERROR: 'Algunos datos no son válidos.',
  DB_CONNECTION_TIMEOUT:
    'El servidor está saturado. Intentalo en unos segundos.',
  DB_ERROR: 'El servidor no responde. Intentalo en unos segundos.',
};

// Fallback `(endpoint, status)` solo si el backend no envia `code`.
const CONTEXT_MESSAGES: Record<string, string> = {
  'auth.login:401': 'Email o contraseña incorrectos.',
  'auth.register:409': 'Ya existe una cuenta con ese email.',
  'auth.refresh:401': 'Tu sesión expiró. Volvé a iniciar sesión.',
  'auth.logout:401': 'Tu sesión ya no es válida.',
};

// Fallback final por HTTP status.
const STATUS_MESSAGES: Record<number, string> = {
  400: 'La solicitud tiene datos inválidos.',
  401: 'No tenés autorización para esta acción.',
  403: 'No tenés permiso para esta acción.',
  404: 'No encontramos lo que buscabas.',
  409: 'Conflicto con el estado actual.',
  422: 'Algunos datos no son válidos.',
  429: 'Demasiados intentos. Esperá unos segundos.',
  500: 'El servidor no responde. Intentalo en unos segundos.',
  502: 'El servidor no responde. Intentalo en unos segundos.',
  503: 'El servidor no responde. Intentalo en unos segundos.',
  504: 'El servidor no responde. Intentalo en unos segundos.',
};

function readProblemCode(error: ApiError): string | undefined {
  const code = (error.problem as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.length > 0 ? code : undefined;
}

/**
 * Texto de un `code` que no llega como error HTTP sino dentro de un dato (p.
 * ej. el `errorCode` de una factura). `undefined` si no hay traducción.
 */
export function translateErrorCode(
  code: string | null | undefined,
): string | undefined {
  return code ? CODE_MESSAGES[code] : undefined;
}

export function translateApiError(
  error: unknown,
  ctx: TranslateContext = {},
): string {
  if (error instanceof ApiError) {
    const code = readProblemCode(error);
    if (code && CODE_MESSAGES[code]) {
      return CODE_MESSAGES[code];
    }
    if (ctx.endpoint) {
      const contextual = CONTEXT_MESSAGES[`${ctx.endpoint}:${error.status}`];
      if (contextual) return contextual;
    }
    const byStatus = STATUS_MESSAGES[error.status];
    if (byStatus) return byStatus;
    return GENERIC_MESSAGE;
  }

  // fetch() falla con TypeError cuando no hay red.
  if (error instanceof TypeError) {
    return NETWORK_MESSAGE;
  }

  return GENERIC_MESSAGE;
}

// Traducciones de los `code` que devuelve cada `ValidationFieldErrorDto`.
// Coinciden con los constraint names de class-validator que usa el backend.
const VALIDATION_CODE_MESSAGES: Record<string, string> = {
  isNotEmpty: 'Este campo es obligatorio.',
  isDefined: 'Este campo es obligatorio.',
  isString: 'Valor inválido.',
  isNumber: 'Debe ser un número.',
  isInt: 'Debe ser un número entero.',
  isBoolean: 'Debe ser verdadero o falso.',
  isEmail: 'Email inválido.',
  // `isUuid` es el nombre real del constraint de class-validator (`IS_UUID`);
  // `isUUID` queda por las dudas, pero el backend nunca lo emite.
  isUuid: 'Identificador inválido.',
  isUUID: 'Identificador inválido.',
  // Lo tira el pipe global con `forbidNonWhitelisted` cuando el body trae una
  // clave de más. Es un bug del front, no del usuario, pero mejor que el genérico.
  whitelistValidation: 'Valor inválido.',
  isDate: 'Fecha inválida.',
  // El backend exige offset explícito en las fechas de métricas: sin él
  // resolvería el instante contra el reloj del servidor (UTC en producción).
  isOffsetDateTime: 'La fecha debe incluir la zona horaria.',
  isIn: 'Valor no permitido.',
  isEnum: 'Valor no permitido.',
  minLength: 'Demasiado corto.',
  maxLength: 'Demasiado largo.',
  min: 'Valor demasiado bajo.',
  max: 'Valor demasiado alto.',
};

// Override por (field, code) para mensajes mas contextuales.
const VALIDATION_FIELD_CODE_MESSAGES: Record<string, string> = {
  'password:minLength': 'La contraseña debe tener al menos 8 caracteres.',
  'password:isNotEmpty': 'Ingresá tu contraseña.',
  'email:isEmail': 'Email inválido.',
  'email:isNotEmpty': 'Ingresá tu email.',
};

/** Un `ValidationFieldErrorDto` reducido a lo que la UI necesita. */
export interface FieldError {
  field: string;
  code: string;
}

/**
 * Los errores por campo de un `400 VALIDATION_FAILED`, o `[]` si el error es
 * otra cosa.
 *
 * El `problem` de un 400 de validación es un `ValidationProblemDetailsDto`, que
 * suma `validationsErrors[]` al resto. Como `ApiError.problem` es la unión de
 * los dos, hay que estrecharla antes de leer el array.
 */
export function readFieldErrors(error: unknown): FieldError[] {
  if (!(error instanceof ApiError) || !error.problem) return [];
  if (!('validationsErrors' in error.problem)) return [];

  const raw: unknown = error.problem.validationsErrors;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item): FieldError[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { field, code } = item as { field?: unknown; code?: unknown };
    if (typeof field !== 'string' || typeof code !== 'string') return [];
    return [{ field, code }];
  });
}

/**
 * Traduce un `ValidationFieldErrorDto.code` (constraint name de
 * class-validator) al mensaje en español que va abajo del input.
 */
export function translateValidationCode(field: string, code: string): string {
  const overrideKey = `${field.toLowerCase()}:${code}`;
  const override = VALIDATION_FIELD_CODE_MESSAGES[overrideKey];
  if (override) return override;
  return VALIDATION_CODE_MESSAGES[code] ?? 'Valor inválido.';
}
