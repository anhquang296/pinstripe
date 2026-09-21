import type { FeatureDefinition } from '@common/types/feature-definition';
import { CRM_NAVIGATION_ITEMS } from '@features/crm/constants/navigation';
import { crmRouteDefs } from '@features/crm/routes/def';
import { crmPaths } from '@features/crm/routes/paths';

export const crmFeature: FeatureDefinition = {
  homePath: crmPaths.OVERVIEW,
  routes: crmRouteDefs,
  navigationItems: CRM_NAVIGATION_ITEMS,
  reportRangePaths: [],
};
