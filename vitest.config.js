import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec}.js'],
    fileParallelism: true,
    setupFiles: ['./test/vitest-setup.js'],
    testTimeout: 10000,
    hookTimeout: 20000

  }
});
