import type { FeatureDefinition } from '@common/types/feature-definition';
import { FeatureToneEnum } from '@common/types/feature-definition';
import { CRM_NAVIGATION_ITEMS } from '@features/crm/constants/navigation';
import { crmRouteDefs } from '@features/crm/routes/def';
import { crmPaths } from '@features/crm/routes/paths';
import { Persons } from '@gravity-ui/icons';

export const crmFeature: FeatureDefinition = {
  title: 'CRM',
  description: 'Nhà xe, người liên hệ, deal và hợp đồng',
  icon: <Persons />,
  tone: FeatureToneEnum.ACCENT,
  homePath: crmPaths.OVERVIEW,
  routes: crmRouteDefs,
  navigationItems: CRM_NAVIGATION_ITEMS,
  reportRangePaths: [],
};
