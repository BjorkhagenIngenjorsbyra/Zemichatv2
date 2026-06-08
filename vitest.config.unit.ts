import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Pure unit tests — no database, network, or Capacitor. Fast, no Docker.
    include: ['src/tests/unit/**/*.unit.test.ts'],
  },
});
