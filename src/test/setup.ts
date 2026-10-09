/**
 * Setup de Vitest: credenciales ficticias de Supabase para los tests.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * `src/lib/supabase/client.ts` lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
 * **en el momento de importarse** y tira si faltan. Eso está bien en la app
 * —es mejor fallar al arrancar que a mitad de un login— pero convierte a ese
 * módulo en veneno para los tests: cualquier archivo que lo importe, aunque
 * sea indirectamente a través de `session.ts`, revienta al cargarse y la suite
 * entera del archivo queda en "0 tests".
 *
 * En local no se notaba porque Vite levanta el `.env` del repo. En CI no hay
 * `.env`, así que el primer test que tocara la sesión rompía el pipeline — y
 * fue exactamente lo que pasó con `CajaPage.test.tsx`.
 *
 * POR QUÉ ACÁ Y NO MOCKEANDO EN CADA TEST
 *
 * Mockear `supabase/client` en cada archivo que lo alcance es una tarea que
 * no termina nunca: la cadena de imports crece y el que la rompe se entera en
 * CI, no al escribir el test. Acá se resuelve una vez para todos.
 *
 * NO DEBILITA LA VALIDACIÓN: la guarda de `client.ts` sigue intacta y sigue
 * tirando en un build real sin configurar. Esto sólo existe dentro de Vitest.
 *
 * `??=` para que un `.env` real gane: si alguien corre los tests contra un
 * Supabase local de verdad, estos valores no le pisan nada.
 */
process.env.VITE_SUPABASE_URL ??= 'http://localhost:54321';
process.env.VITE_SUPABASE_ANON_KEY ??= 'sb_publishable_solo-para-tests';
