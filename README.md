# front-web

Frontend web de Parkit (React + Vite).

## Stack

- React 19 + Vite
- Bun (scripts y lockfile)
- ESLint + Prettier
- Supabase JS
- Tipos de API generados desde OpenAPI

## Primera ejecución

```bash
cp .env.example .env
make install
make env-check
make sync-types
make dev
```

Nota: `make sync-types` requiere backend corriendo y `OPENAPI_URL` accesible (default `http://localhost:3000/api-json`).

## Estructura de carpetas

- `src/main.tsx`: entrypoint.
- `src/App.tsx`: shell inicial.
- `src/lib/supabase/`: cliente y helpers de sesión.
- `src/generated/api-types.ts`: tipos autogenerados desde OpenAPI (no editar a mano).
- `src/test/`: pruebas unitarias.
- `scripts/sync-types.mjs`: generador de tipos OpenAPI.

## Contratos API automáticos ("DTOs" en front)

En frontend no usamos DTOs de Nest. El equivalente son tipos TypeScript generados:

- Fuente: `OPENAPI_URL` (default `http://localhost:3000/api-json`)
- Salida: `src/generated/api-types.ts`

```bash
make sync-types
make sync-types-check
```

Regla: no escribir interfaces manuales para request/response si ya existen en OpenAPI.

Si el backend usa otro puerto:

```bash
OPENAPI_URL=http://localhost:3001/api-json make sync-types
```

## Flujo para una feature nueva

1. Crear carpeta `src/features/<feature>/`.
2. Separar por responsabilidad:
   - `components/` (UI)
   - `hooks/` (estado/queries)
   - `services/` (llamadas HTTP)
3. Tipar requests/responses con `src/generated/api-types.ts`.
4. Agregar tests en `src/test` o en la feature.

## Checklist antes de PR

```bash
make lint
make typecheck
make test
make build
make sync-types-check
```

## Comandos diarios

```bash
make help
make dev
make sync-types
make lint
make typecheck
make test
make build
```

## Git/PR

- PR siempre a `main`.
- `develop` se usa para validación integrada.
- Conventional Commits obligatorios.

Ver [CONTRIBUTING.md](./CONTRIBUTING.md).
