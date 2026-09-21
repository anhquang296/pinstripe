import type { NavigationItem } from '@common/constants/navigation';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';

export enum FeatureToneEnum {
  ACCENT = 'accent',
  SUCCESS = 'success',
  WARNING = 'warning',
  DEFAULT = 'default',
}

export interface FeatureDefinition {
  title: string;
  description: string;
  icon: ReactNode;
  tone: FeatureToneEnum;
  homePath: string;
  routes: RouteObject[];
  navigationItems: NavigationItem[];
  reportRangePaths: string[];
}
