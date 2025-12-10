import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    setupFiles: ['./test/setup-integration.ts'],
    testTimeout: 30000, // Integration tests might take longer
    hookTimeout: 30000,
  },
});
