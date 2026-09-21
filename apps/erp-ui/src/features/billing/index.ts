import type { FeatureDefinition } from '@common/types/feature-definition';
import { BILLING_NAVIGATION_ITEMS } from '@features/billing/constants/navigation';
import { billingRouteDefs } from '@features/billing/routes/def';
import { billingPaths } from '@features/billing/routes/paths';

export const billingFeature: FeatureDefinition = {
  routes: billingRouteDefs,
  navigationItems: BILLING_NAVIGATION_ITEMS,
  reportRangePaths: [billingPaths.OVERVIEW, billingPaths.REPORTS, billingPaths.SUBSCRIPTIONS_USAGE],
};
