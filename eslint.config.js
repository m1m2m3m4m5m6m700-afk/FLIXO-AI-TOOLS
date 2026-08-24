import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['src/tools/image-compressor/index.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Seed intentionally keeps its GPU engine in a ref because WebGL engine instances are imperative resources.
    // Do not weaken react-hooks/refs globally; this exception is scoped to the editor entry point only.
    files: ['src/tools/seed/index.tsx'],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
  prettier,
);
