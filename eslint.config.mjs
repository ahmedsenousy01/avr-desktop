import * as path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  includeIgnoreFile(path.join(import.meta.dirname, '.gitignore')),
  { ignores: ['**/*.config.*'] },
  {
    files: ['**/*.{ts,tsx,js}'],
    plugins: { import: importPlugin },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unnecessary-condition': [
        'warn',
        { allowConstantLoopConditions: true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import/no-duplicates': 'error',
      'import/newline-after-import': 'error',
      // Project preferences
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-empty': 'off',
    },
    languageOptions: {
      parserOptions: { sourceType: 'module', projectService: true },
    },
  },
  // Node (main & preload)
  {
    files: [
      'src/main.ts',
      'src/main/**/*.ts',
      'src/preload.ts',
      'src/preload/**/*.ts',
      'src/main/**/*.js',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
      parserOptions: { sourceType: 'module' },
    },
  },
  // Renderer (browser + React)
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      // React core rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      // React Hooks
      ...reactHooks.configs.recommended.rules,
      // Accessibility rules
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/anchor-is-valid': 'warn',
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2023 },
      parserOptions: { sourceType: 'module' },
    },
    settings: {
      react: { version: 'detect' },
    },
  },
);
