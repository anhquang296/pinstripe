import type { FeatureDefinition } from '@common/types/feature-definition';
import { ADMIN_NAVIGATION_ITEMS } from '@features/admin/constants/navigation';
import { adminRouteDefs } from '@features/admin/routes/def';
import { adminPaths } from '@features/admin/routes/paths';

export const adminFeature: FeatureDefinition = {
  homePath: adminPaths.USERS,
  routes: adminRouteDefs,
  navigationItems: ADMIN_NAVIGATION_ITEMS,
  reportRangePaths: [],
};
