import type { FeatureDefinition } from '@common/types/feature-definition';
import { FeatureToneEnum } from '@common/types/feature-definition';
import { ADMIN_NAVIGATION_ITEMS } from '@features/admin/constants/navigation';
import { adminRouteDefs } from '@features/admin/routes/def';
import { adminPaths } from '@features/admin/routes/paths';
import { Gear } from '@gravity-ui/icons';

export const adminFeature: FeatureDefinition = {
  title: 'Cài đặt',
  description: 'Tài khoản, người dùng, vai trò và tích hợp',
  icon: <Gear />,
  tone: FeatureToneEnum.DEFAULT,
  homePath: adminPaths.SETTINGS_ACCOUNT,
  routes: adminRouteDefs,
  navigationItems: ADMIN_NAVIGATION_ITEMS,
  reportRangePaths: [],
};
