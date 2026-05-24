# AGENT GUIDE (IA) — front-web

## Mision

Entregar features de frontend web sin romper contratos API ni calidad base.

## Stack y limites

- React + Vite + TypeScript.
- Cliente Auth/API: Supabase JS.
- Tipos HTTP: `src/generated/api-types.ts` (OpenAPI).
- Este repo NO administra DB, migraciones ni seeds.

## Reglas obligatorias

1. Nunca editar `src/generated/api-types.ts` a mano.
2. Nunca crear interfaces manuales para request/response si existen en OpenAPI.
3. Ejecutar `make sync-types` cuando cambie backend/auth/contracts.
4. Mantener `App.tsx` liviano; mover logica a `src/features/<feature>/`.
5. Evitar cambios globales de tooling si no son parte del objetivo del ticket.

## Politica de contratos API

- Fuente por defecto: `OPENAPI_URL=http://localhost:3000/api-json`.
- Generacion: `make sync-types` (requiere backend corriendo). Commitear `src/generated/api-types.ts`.
- Tipos manuales permitidos SOLO para view-models internos de UI (no contratos HTTP).

## Donde escribir codigo

- UI y pages: `src/features/<feature>/components`.
- Estado/queries/hooks: `src/features/<feature>/hooks`.
- Llamadas HTTP/adapters: `src/features/<feature>/services`.
- Integracion Supabase comun: `src/lib/supabase/`.
- Tests: `src/test/` o tests colocalizados en la feature.

## Flujo de trabajo recomendado

```bash
cp .env.example .env
make install
make env-check
make sync-types
make dev
```

## Checklist antes de PR

```bash
make lint
make typecheck
make test
make build
```

## Anti-patrones

- No tipar responses como `any`.
- No duplicar tipos de API ya generados.
- No mezclar logica de negocio compleja dentro de componentes visuales.

## Manejo de errores y traduccion

Todo error que vea el usuario pasa por `src/lib/api/translate.ts`.
NUNCA mostrar `error.message` crudo: viene en ingles del backend.

### Precedencia del lookup

1. `problem.code` (estable, lo emite el backend; catalogo en
   `backend/src/utils/exceptions/error-codes.ts`).
2. `(endpoint, status)` — fallback cuando el backend no envia code.
3. `status` HTTP — fallback generico.
4. Mensaje generico "Ocurrió un error inesperado.".

### Uso desde una feature

```tsx
import { useToast } from '../../lib/notifications/ToastProvider';
import { translateApiError } from '../../lib/api/translate';

const { showToast } = useToast();

try {
  await callApi();
} catch (error) {
  showToast({
    message: translateApiError(error, { endpoint: 'auth.login' }),
    kind: 'error',
  });
}
```

### Inline field errors (debajo del input)

- El backend devuelve `ValidationFieldErrorDto[]` con `code` = nombre del
  constraint de class-validator (`isEmail`, `minLength`, etc.).
- Usar `translateValidationCode(field, code)` para el texto en español. Permite
  override por `(field, code)` para mensajes mas naturales (ej.
  `password:minLength` -> "La contraseña debe tener al menos 8 caracteres").
- Validacion local antes de submit en `src/features/<feature>/validation.ts`.

### Agregar un caso nuevo

1. Coordinar con backend para que emita el code apropiado del catalogo (o
   agregue uno nuevo si no existe en `error-codes.ts`).
2. `make sync-types` para refrescar `src/generated/api-types.ts`.
3. Agregar la entrada a `CODE_MESSAGES` en `src/lib/api/translate.ts` (sincronizar
   con `front-desktop` y `front-mobile`).

### Anti-patrones

- No hacer string matching de `error.message` ni de `problem.detail`.
- No mostrar texto del backend tal cual (esta en ingles).
- No duplicar mapeos por status en cada feature: que vivan en `translate.ts`.
- No olvidar el toast envolvente: validar cliente-side primero, luego confiar
  en el `code` del backend para inline.

## Estilo compartido (obligatorio)

- Seguir [SHARED_STYLE_GUIDE.md](./SHARED_STYLE_GUIDE.md) para colores, formas, espaciados y jerarquia visual.
- En pantallas de login: usar botones OAuth con icono de proveedor y sin texto tecnico de debug.
- No introducir variantes visuales fuera de la guia sin actualizar el documento en los 3 repos.
