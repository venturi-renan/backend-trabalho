import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// O SWC é necessário para que os decorators do NestJS (e os metadados de
// injeção de dependência) funcionem dentro do Vitest.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.module.ts', 'src/**/*.spec.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
