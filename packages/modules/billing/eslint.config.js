import { node } from '@vxrerp/eslint-config/node';

export default node({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['migrations/'],
});
