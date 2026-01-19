import js from '@eslint/js';

export default [
  {
    ignores: [
      'node_modules/**',
      'gui/*/node_modules/**',
      'gui/*/dist/**',
      'gui/*/build/**',
      'coverage/**',
      '*.min.js',
      // Generated/vendor files
      'gui/graphql/public/**',
      'gui/admin/dist/**',
      'gui/next/static/prism.js'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.test.js', '**/*.spec.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        fixture: 'readonly'
      }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.js', '!**/*.test.js', '!**/*.spec.js', '!test/**/*.js', '!gui/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        URL: 'readonly',
        module: 'readonly',
        program: 'readonly',
        token: 'readonly',
        gateway: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly',
        query: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-global-assign': 'off'
    }
  },
  {
    files: ['gui/**'],
    rules: {
      'no-console': 'off',
      'no-magic-numbers': 'off',
      'no-underscore-dangle': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'warn',
      'comma-dangle': ['warn', 'never'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['warn', 'always'],
      'indent': ['warn', 2, { SwitchCase: 1 }],
      'brace-style': ['warn', '1tbs'],
      'padded-blocks': 'off',
      'spaced-comment': 'off',
      'quote-props': 'off',
      'prefer-arrow-callback': 'off',
      'space-before-function-paren': 'off',
      'no-new': 'off',
      'func-names': 'off',
      'new-cap': 'off',
      'arrow-body-style': 'off',
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'max-len': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-func-assign': 'off',
      'no-fallthrough': 'off',
      'no-case-declarations': 'off',
      'no-global-assign': 'off',
      'no-cond-assign': 'off',
      'getter-return': 'off',
      'valid-typeof': 'off',
      'no-control-regex': 'off',
      'no-constant-condition': 'off',
      'no-misleading-character-class': 'off',
      'no-async-promise-executor': 'off',
      'no-constant-binary-expression': 'off',
      'no-useless-catch': 'off',
      'no-unreachable': 'off'
    }
  },
  {
    rules: {
      'no-console': 'off',
      'no-magic-numbers': 'off',
      'no-underscore-dangle': 'off',
      'comma-dangle': ['error', 'never'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'brace-style': ['error', '1tbs'],
      'padded-blocks': 'off',
      'spaced-comment': ['warn', 'always'],
      'quote-props': 'off',
      'prefer-arrow-callback': 'off',
      'space-before-function-paren': 'off',
      'no-new': 'off',
      'func-names': 'off',
      'new-cap': 'off',
      'arrow-body-style': 'off',
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'max-len': ['warn', { code: 140, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      'no-empty': 'warn',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'warn',
      'no-async-promise-executor': 'warn',
      'no-constant-binary-expression': 'warn',
      'no-useless-catch': 'warn',
      'no-unreachable': 'warn',
      'no-global-assign': 'off'
    }
  }
];
