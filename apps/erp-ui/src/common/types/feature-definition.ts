import type { NavigationItem } from '@common/constants/navigation';
import type { RouteObject } from 'react-router-dom';

export interface FeatureDefinition {
  routes: RouteObject[];
  navigationItems: NavigationItem[];
  reportRangePaths: string[];
}
