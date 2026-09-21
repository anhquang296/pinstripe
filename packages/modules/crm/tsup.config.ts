import { defineConfig } from 'tsup';

export default defineConfig((options) => {
  return {
    entry: ['src/database/index.ts', 'src/plugins/index.ts'],
    format: ['esm'],
    target: 'node22',
    outDir: 'dist',
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: !options.watch,
  };
});
