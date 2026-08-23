import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Logic modules are pure and framework-free, so they need no DOM
    // environment. If a test ever needs one, that logic is in the wrong place.
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
});
