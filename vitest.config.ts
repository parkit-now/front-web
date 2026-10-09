import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Config de los tests, aparte de la de Vite.
 *
 * Va en su propio archivo y no como un bloque `test` dentro de `vite.config.ts`
 * porque ese bloque sólo lo tipa `defineConfig` de `vitest/config`, y ese
 * `defineConfig` discute con los tipos de `@vitejs/plugin-react`. `mergeConfig`
 * evita las dos cosas: la config de Vite queda intacta y los tipos cierran.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Credenciales ficticias de Supabase. Ver el archivo: sin esto, todo
      // test que alcance `supabase/client.ts` —aunque sea por una cadena de
      // imports— falla al CARGARSE en CI, donde no existe el `.env`.
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
);
