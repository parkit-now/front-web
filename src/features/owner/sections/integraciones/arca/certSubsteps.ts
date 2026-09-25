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

/** Los 5 sub-pasos del certificado, en los dos entornos. */
export type CertSubstepId = 1 | 2 | 3 | 4 | 5;

export const CERT_SUBSTEP_IDS: readonly CertSubstepId[] = [1, 2, 3, 4, 5];

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
 * `completed` sólo guarda los sub-pasos 1 a 4: son los que se confirman a
 * mano con "Listo, sigo →". El 5 no tiene ese botón — termina en "Verificar",
 * que es una llamada al backend, no una casilla que el dueño tilda.
 *
 * `errorSubstep` es el sub-paso que el último error de "Verificar" dejó
 * marcado en rojo, o `null` si no hay ninguno marcado.
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
 * Cuál sub-paso tiene que estar abierto por defecto: el que quedó marcado en
 * rojo (hay que arreglarlo antes de seguir), o si no hay ninguno, el primero
 * sin completar. El 5 nunca aparece en `completed` (no tiene botón propio),
 * así que es el destino natural una vez que 1 a 4 están listos.
 */
export function resolveOpenCertSubstep(progress: CertProgress): CertSubstepId {
  if (progress.errorSubstep !== null) return progress.errorSubstep;
  for (const id of CERT_SUBSTEP_IDS) {
    if (id === 5) return 5;
    if (!progress.completed.includes(id)) return id;
  }
  return 5;
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
  if (id !== 5 && progress.completed.includes(id)) return 'completed';
  return id === resolveOpenCertSubstep(progress) ? 'current' : 'locked';
}

/** Marca un sub-paso (1 a 4) como confirmado con "Listo, sigo →". */
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

/** A qué sub-paso manda cada `code` de un 422 al verificar el certificado. */
export interface CertVerifyErrorEffect {
  /** Sub-paso donde mostrar el aviso (siempre hay uno: es donde vive "Verificar"). */
  substep: CertSubstepId;
  /** Si además hay que pintar ESE sub-paso en rojo. */
  markError: boolean;
}

/**
 * Mapeo código → sub-paso, para saber qué arreglar.
 *
 *  - `ARCA_CERT_NOT_AUTHORIZED`: falta autorizar los servicios → sub-paso 5.
 *  - `ARCA_CERT_INVALID` / `ARCA_CERT_CUIT_MISMATCH` / `ARCA_CERT_EXPIRED`:
 *    el certificado pegado no sirve → sub-paso 4 (hay que pegar otro).
 *  - `ARCA_CERT_KEY_MISMATCH`: el certificado no corresponde a ESTA
 *    solicitud → también sub-paso 4, aunque el arreglo real sea rehacer el
 *    sub-paso 3 (generar de nuevo con el CSR de acá); el mensaje traducido
 *    ya lo aclara.
 *  - Cualquier otro código (`ARCA_UNAVAILABLE`, un 500, etc.): no es culpa de
 *    ningún sub-paso puntual — se avisa en el 5 (ahí vive el botón) SIN
 *    pintar nada en rojo.
 */
export function resolveCertVerifyErrorEffect(
  code: string | undefined,
): CertVerifyErrorEffect {
  switch (code) {
    case 'ARCA_CERT_NOT_AUTHORIZED':
      return { substep: 5, markError: true };
    case 'ARCA_CERT_INVALID':
    case 'ARCA_CERT_CUIT_MISMATCH':
    case 'ARCA_CERT_EXPIRED':
    case 'ARCA_CERT_KEY_MISMATCH':
      return { substep: 4, markError: true };
    default:
      return { substep: 5, markError: false };
  }
}

/**
 * Aplica el efecto de un error de "Verificar" al progreso guardado.
 *
 * OJO: si el código no marca ningún sub-paso (`markError: false`), el
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
  if (!effect.markError) return progress;
  return { ...progress, errorSubstep: effect.substep };
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
