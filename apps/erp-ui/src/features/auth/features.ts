import type { FeatureDefinition } from '@common/types/feature-definition';
import { buildNavigationGroups, matchesReportRange } from '@common/utils/navigation';
import { adminFeature } from '@features/admin';
import { billingFeature } from '@features/billing';
import { crmFeature } from '@features/crm';
import { flatMap } from 'lodash-es';

export const ERP_FEATURES: FeatureDefinition[] = [adminFeature, billingFeature, crmFeature];

const reportRangePaths = flatMap(ERP_FEATURES, 'reportRangePaths');

export const NAVIGATION_GROUPS = buildNavigationGroups(flatMap(ERP_FEATURES, 'navigationItems'));

export const HOME_PATH = billingFeature.homePath;

export const FEATURE_ROUTES = flatMap(ERP_FEATURES, 'routes');

export function hasReportRange(pathname: string): boolean {
  return matchesReportRange(reportRangePaths, pathname);
}
