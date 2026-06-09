/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'client/'],
  rules: {
    // Codebase legado — evita bloquear CI em padrões já existentes no projeto
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/ban-types': 'off',
    'no-console': 'off',
    'no-useless-escape': 'warn',
    'no-case-declarations': 'off',
    'no-fallthrough': 'warn',
    'no-var': 'warn',
    'prefer-const': 'warn',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
