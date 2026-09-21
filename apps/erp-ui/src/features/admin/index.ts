import type { FeatureDefinition } from '@common/types/feature-definition';
import { ADMIN_NAVIGATION_ITEMS } from '@features/admin/constants/navigation';
import { adminRouteDefs } from '@features/admin/routes/def';

export const adminFeature: FeatureDefinition = {
  routes: adminRouteDefs,
  navigationItems: ADMIN_NAVIGATION_ITEMS,
  reportRangePaths: [],
};
