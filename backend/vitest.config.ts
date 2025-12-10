import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/unit/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['test/integration/**/*.test.ts', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/[.]**',
        '**/*.d.ts',
        '**/*{.,-}{test,spec}.ts',
        '**/test/**',
        '**/drizzle/**',
        '**/drizzle.config.ts',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    setupFiles: ['./test/setup-unit.ts'],
  },
});
