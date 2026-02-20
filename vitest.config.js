import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec}.js'],
    fileParallelism: true,
    globalSetup: ['./test/global-setup.js'],
    setupFiles: ['./test/vitest-setup.js'],
    testTimeout: 10000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/**/*.js', 'bin/**/*.js'],
      exclude: [
        'gui/**',
        'test/**',
        'scripts/**',
        'node_modules/**',
        '**/*.config.js'
      ],
      all: true,
      clean: true,
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    }
  }
});
