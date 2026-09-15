import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/config/index.ts',
    'src/database/index.ts',
    'src/errors/index.ts',
    'src/plugins/index.ts',
    'src/queues/index.ts',
    'src/repositories/index.ts',
    'src/services/index.ts',
    'src/types/index.ts',
    'src/utils/index.ts',
  ],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
});
