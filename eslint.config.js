import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'ops/', 'public/'] },
  js.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
    },
  },
  {
    // PocketBase JS hooks and migrations run in PocketBase's own engine, which
    // provides these globals.
    files: ['backend/pb_hooks/**/*.js', 'backend/pb_migrations/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        $app: 'readonly',
        $security: 'readonly',
        $os: 'readonly',
        __hooks: 'readonly',
        migrate: 'readonly',
        routerAdd: 'readonly',
        cronAdd: 'readonly',
        onRecordCreate: 'readonly',
        onRecordUpdate: 'readonly',
        onRecordRequestOTPRequest: 'readonly',
        Collection: 'readonly',
        Record: 'readonly',
        SelectField: 'readonly',
      },
    },
  },
];
