import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';

// Custom rule to warn when underscore-prefixed parameters are used
const noUseUnderscorePrefixed = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow using function parameters that start with underscore',
      category: 'Best Practices'
    },
    messages: {
      noUseUnderscore: 'Parameter "{{name}}" starts with underscore, indicating it should be unused. Either use it (and remove _) or don\'t use it.'
    },
    schema: []
  },
  create(context) {
    const functionScopes = [];

    return {
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node) {
        // Track function parameters starting with _ (but not __ like __dirname, __filename)
        const underscoreParams = new Map();
        node.params.forEach(param => {
          if (param.type === 'Identifier' &&
              param.name.startsWith('_') &&
              !param.name.startsWith('__')) {
            underscoreParams.set(param.name, param);
          }
        });
        functionScopes.push({ node, params: underscoreParams });
      },
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression:exit'() {
        functionScopes.pop();
      },
      'Identifier'(node) {
        // Skip if this is __dirname or __filename or any other __ prefixed identifier
        if (!node.name.startsWith('_') || node.name.startsWith('__')) {
          return;
        }

        // Check if we're in a function scope that has this as a parameter
        for (let i = functionScopes.length - 1; i >= 0; i--) {
          const scope = functionScopes[i];
          const paramNode = scope.params.get(node.name);
          if (paramNode) {
            // Only report if this is NOT the parameter declaration itself
            // Check if this node is the same as the parameter node
            if (node !== paramNode) {
              context.report({
                node,
                messageId: 'noUseUnderscore',
                data: { name: node.name }
              });
            }
            break;
          }
        }
      }
    };
  }
};

const customPlugin = {
  rules: {
    'no-use-underscore-prefixed': noUseUnderscorePrefixed
  }
};

export default [
  {
    ignores: [
      'node_modules/**',
      'gui/*/node_modules/**',
      'gui/*/dist/**',
      'gui/*/build/**',
      'gui/*/src/**',
      'gui/*/tests/**',
      'gui/*/*.config.js',
      'gui/next/.svelte-kit/**',
      'gui/next/test-results/**',
      'gui/next/playwright-report/**',
      'gui/next/playwright/**',
      'coverage/**',
      '*.min.js',
      'test/fixtures/**',
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
      // Variables/params starting with _ are conventionally unused. If you use it, remove the _.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'n/no-missing-import': 'off'
    }
  },
  {
    files: ['**/*.js', '!**/*.test.js', '!**/*.spec.js', '!test/**/*.js', '!gui/**'],
    plugins: {
      n: nodePlugin,
      import: importPlugin,
      promise: promisePlugin,
      custom: customPlugin
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.json']
        }
      }
    },
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
        AbortController: 'readonly',
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
      // Variables/params starting with _ are conventionally unused. This config ignores them in unused-var checks.
      // IMPORTANT: If you prefix a variable with _, DO NOT use it in the code. If you use it, remove the _.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'custom/no-use-underscore-prefixed': 'warn',
      'no-global-assign': 'off',
      'n/no-missing-import': ['error', {
        tryExtensions: ['.js', '.json'],
        allowModules: ['vitest']
      }],
      'n/no-extraneous-import': 'off',
      'n/no-extraneous-require': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
      'n/no-process-exit': 'off',
      'import/no-unresolved': ['error', { ignore: ['^@platformos/', '^#lib/', '^#test/', '^vitest/'] }],
      'import/extensions': 'off'
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
