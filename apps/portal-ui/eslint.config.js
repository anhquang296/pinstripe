import { react } from '@vxrerp/eslint-config/react';

export default react({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['**/.next/', '**/next-env.d.ts'],
  hasLodash: true,
});
