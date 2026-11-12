import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@esheet/catalog',
    root: import.meta.dirname,
    environment: 'node',
    globals: true,
    watch: false,
    include: ['src/runtime/**/*.test.ts'],
  },
});
