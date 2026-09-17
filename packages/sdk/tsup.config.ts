import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/react/index.ts', 'src/node/index.ts'],
  format: ['esm'],
  target: 'es2022',
  outDir: 'dist',
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
});
