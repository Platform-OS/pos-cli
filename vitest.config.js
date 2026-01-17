import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec,vitest}.js'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    setupFiles: ['./test/vitest-setup.js']
  }
});
