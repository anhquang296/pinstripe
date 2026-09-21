import type { NavigationItem } from '@common/constants/navigation';
import type { RouteObject } from 'react-router-dom';

export interface FeatureDefinition {
  homePath: string;
  routes: RouteObject[];
  navigationItems: NavigationItem[];
  reportRangePaths: string[];
}
