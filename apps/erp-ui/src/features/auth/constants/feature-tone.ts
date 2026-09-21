import { FeatureToneEnum } from '@common/types/feature-definition';

export const FEATURE_TONE_CLASSES: Record<FeatureToneEnum, string> = {
  [FeatureToneEnum.ACCENT]: 'bg-accent-soft text-accent',
  [FeatureToneEnum.SUCCESS]: 'bg-success-soft text-success',
  [FeatureToneEnum.WARNING]: 'bg-warning-soft text-warning',
  [FeatureToneEnum.DEFAULT]: 'bg-default text-foreground',
};
