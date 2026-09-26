/**
 * Lógica pura del acordeón de sub-pasos del paso 2 («Certificado ARCA»):
 * cuál está abierto, bloqueado, completado o en error, y cómo lo mueve un
 * error de "Verificar". Separada del componente (con tests colocalizados)
 * por la misma razón que `wizard.ts`: la secuencia se rompe en silencio y
 * probarla no necesita ni DOM ni red.
 *
 * También vive acá la persistencia en `localStorage` del progreso: si el
 * dueño recarga la página o vuelve de la pestaña de ARCA, no pierde en qué
 * sub-paso estaba. Es best-effort (todo en `try/catch`): sin `localStorage`
 * (modo privado, storage lleno, iframe restringido) la pantalla arranca
 * igual desde el sub-paso 1, sólo pierde la memoria entre recargas.
 */

/**
 * Los 6 sub-pasos del certificado, en los dos entornos. El 5 ("Autorizá los
 * servicios") es informativo y termina en "Listo, sigo →"; la verificación
 * contra ARCA se separó a un sub-paso propio, el 6 ("Verificá la
 * vinculación"), para que un error de "Verificar" tenga un lugar fijo donde
 * mostrarse sin importar cuál sub-paso haya sido el culpable.
 */
export type CertSubstepId = 1 | 2 | 3 | 4 | 5 | 6;

export const CERT_SUBSTEP_IDS: readonly CertSubstepId[] = [1, 2, 3, 4, 5, 6];

/**
 * Estado visual del título del acordeón:
 *  - `completed`: círculo verde con tilde.
 *  - `current`: número con el color primario (el que está abierto).
 *  - `locked`: número gris, no se puede abrir todavía.
 *  - `error`: círculo rojo con X — falló la verificación por algo de este
 *    sub-paso.
 */
export type CertSubstepVisualState =
  | 'completed'
  | 'current'
  | 'locked'
  | 'error';

/**
 * Progreso persistido del acordeón.
 *
 * `completed` guarda los sub-pasos 1 a 5: son los que se confirman a mano
 * con "Listo, sigo →". El 6 no tiene ese botón — termina en "Verificar", que
 * es una llamada al backend, no una casilla que el dueño tilda.
 *
 * `errorSubstep` es el sub-paso CULPABLE que el último error de "Verificar"
 * dejó marcado en rojo (4 o 5), o `null` si no hay ninguno marcado. Nunca es
 * `6`: ese sub-paso no se marca en rojo, sólo es donde se lee el aviso (ver
 * `resolveOpenCertSubstep`).
 *
 * Migración: progreso guardado por una versión anterior (5 sub-pasos, sin el
 * 6) sigue cargando bien — `completed` es un subconjunto válido igual, y con
 * el 5 ya completado el dueño simplemente retoma en el 6, que es nuevo.
 */
export interface CertProgress {
  completed: readonly CertSubstepId[];
  errorSubstep: CertSubstepId | null;
}

export const EMPTY_CERT_PROGRESS: CertProgress = {
  completed: [],
  errorSubstep: null,
};

/**
 * Cuál sub-paso tiene que estar abierto por defecto.
 *
 * Es el primero sin completar entre 1 y 5, o el 6 una vez que los 5 están
 * listos — el 6 nunca aparece en `completed` (no tiene botón propio), así
 * que es el destino natural. Esto vale INCLUSO con un `errorSubstep` marcado:
 * el sub-paso culpable (4 o 5) sigue en `completed` (marcarlo en rojo no lo
 * saca de ahí), así que el loop lo salta igual y llega al 6, que es donde
 * hay que leer el aviso del error. El dueño llega al sub-paso rojo clickeando
 * su título (no está bloqueado, sólo en error) o con "Volver" desde el 6.
 */
export function resolveOpenCertSubstep(progress: CertProgress): CertSubstepId {
  for (const id of CERT_SUBSTEP_IDS) {
    if (id === 6) return 6;
    if (!progress.completed.includes(id)) return id;
  }
  return 6;
}

/**
 * El sub-paso anterior a `id`, para el botón "Volver". `null` en el 1: no
 * hay a dónde volver.
 *
 * Volver NO toca el progreso (no descompleta nada): sólo cambia cuál
 * sub-paso está abierto, así que vive aparte de `resolveOpenCertSubstep`.
 */
export function resolvePreviousCertSubstep(
  id: CertSubstepId,
): CertSubstepId | null {
  const index = CERT_SUBSTEP_IDS.indexOf(id);
  return index > 0 ? CERT_SUBSTEP_IDS[index - 1] : null;
}

/** Estado visual de UN sub-paso puntual, para pintar su título. */
export function resolveCertSubstepState(
  id: CertSubstepId,
  progress: CertProgress,
): CertSubstepVisualState {
  if (progress.errorSubstep === id) return 'error';
  if (id !== 6 && progress.completed.includes(id)) return 'completed';
  return id === resolveOpenCertSubstep(progress) ? 'current' : 'locked';
}

/** Marca un sub-paso (1 a 5) como confirmado con "Listo, sigo →". */
export function markCertSubstepDone(
  progress: CertProgress,
  id: CertSubstepId,
): CertProgress {
  const completed = progress.completed.includes(id)
    ? progress.completed
    : [...progress.completed, id];
  // Si este era el que estaba en rojo, arreglarlo lo vuelve a poner verde.
  const errorSubstep =
    progress.errorSubstep === id ? null : progress.errorSubstep;
  return { completed, errorSubstep };
}

/** A qué sub-paso manda cada `code` de un error al verificar la vinculación. */
export interface CertVerifyErrorEffect {
  /**
   * Dónde se abre y se lee el aviso: SIEMPRE el 6 ("Verificá la
   * vinculación"), que es donde vive el botón "Verificar". Antes (con 5
   * sub-pasos) esto variaba; ahora que la verificación tiene su propio
   * sub-paso, el aviso siempre se lee ahí.
   */
  openSubstep: CertSubstepId;
  /**
   * El sub-paso CULPABLE — el que hay que arreglar y el que se marca en
   * rojo — o `null` si el error no apunta a uno en particular.
   */
  culpritSubstep: CertSubstepId | null;
}

/**
 * Mapeo código → sub-paso culpable, para saber qué arreglar.
 *
 *  - `ARCA_CERT_NOT_AUTHORIZED`: falta autorizar los servicios → sub-paso 5.
 *  - `ARCA_CERT_INVALID` / `ARCA_CERT_CUIT_MISMATCH` / `ARCA_CERT_EXPIRED`:
 *    el certificado pegado no sirve → sub-paso 4 (hay que pegar otro).
 *  - `ARCA_CERT_KEY_MISMATCH`: el certificado no corresponde a ESTA
 *    solicitud → también sub-paso 4, aunque el arreglo real sea rehacer el
 *    sub-paso 3 (generar de nuevo con el CSR de acá); el mensaje traducido
 *    ya lo aclara.
 *  - Cualquier otro código (`ARCA_UNAVAILABLE`, un 500, etc.): no es culpa de
 *    ningún sub-paso puntual — `culpritSubstep: null`, no se pinta nada en
 *    rojo.
 */
export function resolveCertVerifyErrorEffect(
  code: string | undefined,
): CertVerifyErrorEffect {
  switch (code) {
    case 'ARCA_CERT_NOT_AUTHORIZED':
      return { openSubstep: 6, culpritSubstep: 5 };
    case 'ARCA_CERT_INVALID':
    case 'ARCA_CERT_CUIT_MISMATCH':
    case 'ARCA_CERT_EXPIRED':
    case 'ARCA_CERT_KEY_MISMATCH':
      return { openSubstep: 6, culpritSubstep: 4 };
    default:
      return { openSubstep: 6, culpritSubstep: null };
  }
}

/**
 * Aplica el efecto de un error de "Verificar" al progreso guardado.
 *
 * OJO: si el código no marca ningún sub-paso (`culpritSubstep: null`), el
 * progreso NO se toca. Si ya había un sub-paso en rojo de un intento
 * anterior (por ejemplo, un certificado inválido) y este intento nuevo
 * falla por algo genérico (`ARCA_UNAVAILABLE`), ese rojo anterior sigue
 * ahí: todavía no se arregló, y un error de red no es "ya está resuelto".
 */
export function applyCertVerifyError(
  progress: CertProgress,
  code: string | undefined,
): CertProgress {
  const effect = resolveCertVerifyErrorEffect(code);
  if (effect.culpritSubstep === null) return progress;
  return { ...progress, errorSubstep: effect.culpritSubstep };
}

// ── Persistencia (localStorage) ──────────────────────────────────────────────

function certProgressStorageKey(tenantId: string, accountId: string): string {
  return `parkit.arca.certProgress.${tenantId}.${accountId}`;
}

function isCertSubstepId(value: unknown): value is CertSubstepId {
  return (
    typeof value === 'number' &&
    (CERT_SUBSTEP_IDS as readonly number[]).includes(value)
  );
}

/** Valida lo leído de `localStorage`: un dato corrupto no puede tirar la pantalla. */
function parseCertProgress(raw: string): CertProgress {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return EMPTY_CERT_PROGRESS;
  const maybe = parsed as { completed?: unknown; errorSubstep?: unknown };
  const completed = Array.isArray(maybe.completed)
    ? maybe.completed.filter(isCertSubstepId)
    : [];
  const errorSubstep = isCertSubstepId(maybe.errorSubstep)
    ? maybe.errorSubstep
    : null;
  return { completed, errorSubstep };
}

/** Lee el progreso guardado, o `EMPTY_CERT_PROGRESS` si no hay o falla. */
export function loadCertProgress(
  tenantId: string,
  accountId: string,
): CertProgress {
  try {
    const raw = window.localStorage.getItem(
      certProgressStorageKey(tenantId, accountId),
    );
    if (!raw) return EMPTY_CERT_PROGRESS;
    return parseCertProgress(raw);
  } catch {
    return EMPTY_CERT_PROGRESS;
  }
}

/** Guarda el progreso. Falla en silencio: no hay nada que el dueño pueda hacer. */
export function saveCertProgress(
  tenantId: string,
  accountId: string,
  progress: CertProgress,
): void {
  try {
    window.localStorage.setItem(
      certProgressStorageKey(tenantId, accountId),
      JSON.stringify(progress),
    );
  } catch {
    // Sin storage disponible, la pantalla sigue funcionando: sólo no
    // recuerda el progreso entre recargas.
  }
}
