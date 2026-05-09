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
- Generacion: `make sync-types`.
- Guardrail CI/local: `make sync-types-check`.
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
make sync-types-check
```

## Anti-patrones

- No tipar responses como `any`.
- No duplicar tipos de API ya generados.
- No mezclar logica de negocio compleja dentro de componentes visuales.
