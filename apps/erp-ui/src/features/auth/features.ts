import type { FeatureDefinition } from '@common/types/feature-definition';
import { matchesReportRange } from '@common/utils/navigation';
import { adminFeature } from '@features/admin';
import { billingFeature } from '@features/billing';
import { crmFeature } from '@features/crm';
import { flatMap } from 'lodash-es';

export const ERP_FEATURES: FeatureDefinition[] = [crmFeature, billingFeature, adminFeature];

export const SETTINGS_FEATURE = adminFeature;

const reportRangePaths = flatMap(ERP_FEATURES, 'reportRangePaths');

export function hasReportRange(pathname: string): boolean {
  return matchesReportRange(reportRangePaths, pathname);
}
