import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/sim/**/*.sim.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // Reuse the RLS seeded world + per-file state reset.
    globalSetup: ['src/tests/rls/helpers/global-setup.ts'],
    setupFiles: ['src/tests/rls/helpers/reset-state.ts'],
  },
});
