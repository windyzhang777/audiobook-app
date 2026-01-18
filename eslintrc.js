module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json', // Important for type-aware linting
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'prettier', // Must be last to override other configs
  ],
  plugins: [
    '@typescript-eslint',
    'react',
    'react-native',
    'prettier',
  ],
  env: {
    'react-native/react-native': true,
    es2021: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // ========================================
    // STRICT TYPE RULES - NO 'any' ALLOWED
    // ========================================
    '@typescript-eslint/no-explicit-any': 'error', // Disallow 'any' type
    '@typescript-eslint/no-unsafe-assignment': 'error', // Disallow assigning any to variables
    '@typescript-eslint/no-unsafe-member-access': 'error', // Disallow accessing members of any
    '@typescript-eslint/no-unsafe-call': 'error', // Disallow calling any
    '@typescript-eslint/no-unsafe-return': 'error', // Disallow returning any
    '@typescript-eslint/no-unsafe-argument': 'error', // Disallow any as function arguments

    // Additional strict type checking
    '@typescript-eslint/strict-boolean-expressions': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',

    // ========================================
    // GENERAL TYPESCRIPT RULES
    // ========================================
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
    }],
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // ========================================
    // REACT RULES
    // ========================================
    'react/react-in-jsx-scope': 'off', // Not needed in React Native
    'react/prop-types': 'off', // Using TypeScript instead
    'react/display-name': 'off',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-unused-styles': 'error',
    'react-native/no-color-literals': 'warn',

    // ========================================
    // PRETTIER INTEGRATION
    // ========================================
    'prettier/prettier': 'error',

    // ========================================
    // GENERAL CODE QUALITY
    // ========================================
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
  },
};