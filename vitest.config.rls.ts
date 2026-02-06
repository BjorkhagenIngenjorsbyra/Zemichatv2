import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/rls/**/*.rls.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // Seed data once before all test suites via globalSetup
    globalSetup: ['src/tests/rls/helpers/global-setup.ts'],
  },
});
