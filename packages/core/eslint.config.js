import { node } from '@pinstripe/eslint-config/node';

export default node({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['migrations/'],
});
