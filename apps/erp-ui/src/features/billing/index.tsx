import type { FeatureDefinition } from '@common/types/feature-definition';
import { FeatureToneEnum } from '@common/types/feature-definition';
import { BILLING_NAVIGATION_ITEMS } from '@features/billing/constants/navigation';
import { billingRouteDefs } from '@features/billing/routes/def';
import { billingPaths } from '@features/billing/routes/paths';
import { CreditCard } from '@gravity-ui/icons';

export const billingFeature: FeatureDefinition = {
  title: 'Billing',
  description: 'Thuê bao, hoá đơn, thanh toán và sổ cái',
  icon: <CreditCard />,
  tone: FeatureToneEnum.SUCCESS,
  homePath: billingPaths.OVERVIEW,
  routes: billingRouteDefs,
  navigationItems: BILLING_NAVIGATION_ITEMS,
  reportRangePaths: [
    billingPaths.OVERVIEW,
    billingPaths.REPORTS,
    `${billingPaths.SUBSCRIPTIONS_USAGE}/*`,
  ],
};
