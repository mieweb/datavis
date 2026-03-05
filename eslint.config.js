import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Relax rules that conflict with the codebase patterns
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // autoFocus is intentional UX on filter inputs
      'jsx-a11y/no-autofocus': 'warn',
      // Data grids use treegrid/grid role on <table> and separator role on resize handles
      'jsx-a11y/no-noninteractive-element-to-interactive-role': [
        'error',
        { table: ['treegrid', 'grid'], tr: ['row'] },
      ],
      'jsx-a11y/no-noninteractive-element-interactions': [
        'error',
        { handlers: ['onClick'] },
      ],
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { roles: ['separator', 'tabpanel'] },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'wcdatavis/', '*.config.*'],
  },
);
