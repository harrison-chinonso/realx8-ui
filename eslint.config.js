import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * What this is for, and what it deliberately is not.
 *
 * ── The gap it fills ────────────────────────────────────────────────────────
 *
 * `vite build` transforms each file; it does not RESOLVE identifiers. A
 * component referring to a variable that is not in scope — an import that was
 * never added, a state hook that was removed, a prop destructured in one
 * component and used in another — builds perfectly and throws the moment the
 * component renders. That happened three times in one afternoon here: a
 * launcher that white-screened on `section is not defined`, six layouts using a
 * store they never imported, and a Field wrapper reading a `required` that was
 * not one of its props. Every one of them passed the build and was found by
 * loading the page.
 *
 * `no-undef` is the rule that catches all three, and it is the reason this file
 * exists.
 *
 * ── Why it is not a style guide ─────────────────────────────────────────────
 *
 * This codebase is large, opinionated and consistent with itself. Turning on a
 * formatting preset would bury the handful of findings that matter under
 * thousands that do not, and a report nobody reads is worth less than no report
 * at all. So: correctness rules as errors, tidiness as warnings, and nothing
 * about quotes, semicolons or line length.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },

  js.configs.recommended,

  // ── The application ───────────────────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      /*
       * Without this, every component imported purely for JSX reads as unused
       * and no-unused-vars drowns the report in false positives.
       */
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',

      // The hooks rules catch a class of bug as invisible to the build as
      // no-undef: a hook called conditionally, or an effect reading state it
      // never declared a dependency on.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // A leftover is worth knowing about; it is not worth failing a build for.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // `catch {}` is used deliberately throughout for best-effort lookups.
      'no-empty': ['error', { allowEmptyCatch: true }],
      /*
       * Not in strings or templates. tableExport prepends a BOM to its CSV so
       * Excel reads it as UTF-8 rather than the local codepage — that character
       * is the feature, and flagging it would teach people to ignore the rule
       * in the one place it would otherwise catch a stray non-breaking space in
       * actual code.
       */
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
    },
  },

  /*
   * The assistant's knowledge base and its tests live under src/ but run in
   * NODE, not the browser — they are invoked by `npm run assistant:test`. Left
   * with browser globals, every console.log in them reads as an undefined
   * identifier and buries the real ones.
   */
  {
    files: ['src/assistant/**/*.{mjs,js}'],
    languageOptions: {
      // 2025 for import attributes — `import map from './x.json' with { type: 'json' }`.
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // ── Node: build scripts, verification harnesses, config ───────────────────
  {
    files: ['scripts/**/*.{js,cjs,mjs}', '*.config.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
];
