import { defineConfig } from 'tsup';

export default defineConfig((options) => {
  return {
    entry: ['src/index.ts', 'src/react/index.ts', 'src/react/portal/index.ts', 'src/node/index.ts'],
    format: ['esm'],
    target: 'es2022',
    outDir: 'dist',
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: !options.watch,
  };
});
