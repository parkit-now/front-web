// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'out/**',
      '.expo/**',
      'src/generated/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Un `useMemo` que lee una variable y no la declara acá devuelve siempre
      // el valor viejo. Es un bug invisible —compila, pasa los tests, y la
      // pantalla simplemente no reacciona— y ya nos costó el filtrado por
      // cards de Auditoría, donde la card se encendía y la tabla no cambiaba.
      //
      // Va como `warn` y no como `error` a propósito: el repo nunca tuvo esta
      // regla y arrastra violaciones viejas. Ponerla en `error` dejaría el CI
      // rojo por deuda previa en vez de por el cambio que la introduce.
      // Cuando esas se limpien, sube a `error`.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
);
