import { react } from '@pinstripe/eslint-config/react';

export default react({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['.next/', 'next-env.d.ts'],
});
