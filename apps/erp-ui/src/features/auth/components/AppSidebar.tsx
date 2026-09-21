import type { FeatureDefinition } from '@common/types/feature-definition';
import { buildNavigationGroups, findVisibleNavigationItems } from '@common/utils/navigation';
import { FEATURE_TONE_CLASSES } from '@features/auth/constants/feature-tone';
import { authPaths } from '@features/auth/routes/paths';
import { ArrowLeft } from '@gravity-ui/icons';
import { cn } from '@libs/cn';
import { usePermissions } from '@libs/permissions';
import { map } from 'lodash-es';
import { Link, NavLink } from 'react-router-dom';

interface AppSidebarProps {
  feature: FeatureDefinition;
}

export default function AppSidebar({ feature }: AppSidebarProps) {
  const permissions = usePermissions();

  const navigationGroups = buildNavigationGroups(
    findVisibleNavigationItems(feature.navigationItems, permissions),
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-sidebar flex-col border-r border-separator bg-surface">
      <Link
        to={authPaths.LAUNCHER}
        aria-label={`Rời ${feature.title}, về màn chọn ứng dụng`}
        className="group flex h-topbar items-center gap-2 border-b border-separator px-4 outline-none hover:bg-default focus-visible:bg-default"
      >
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md [&>svg]:size-4',
            'group-hover:hidden group-focus-visible:hidden',
            FEATURE_TONE_CLASSES[feature.tone],
          )}
        >
          {feature.icon}
        </span>
        <span className="hidden size-7 items-center justify-center rounded-md bg-surface text-foreground group-hover:flex group-focus-visible:flex [&>svg]:size-4">
          <ArrowLeft />
        </span>
        <span className="flex flex-col">
          <span className="text-[14px] leading-5 font-semibold">{feature.title}</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto py-3">
        {map(navigationGroups, (navigationGroup) => {
          return (
            <div key={navigationGroup.label} className="flex flex-col gap-1">
              <span className="px-4 text-[11px] font-semibold text-muted uppercase">
                {navigationGroup.label}
              </span>

              {map(navigationGroup.items, (navigationItem) => {
                return (
                  <NavLink
                    key={navigationItem.to}
                    to={navigationItem.to}
                    end={navigationItem.to === feature.homePath}
                    className={({ isActive }) => {
                      return cn(
                        'flex items-start gap-2 border-l-2 border-transparent px-4 py-2',
                        isActive ? 'border-l-accent bg-accent-soft text-accent' : 'text-foreground',
                      );
                    }}
                  >
                    <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-xs bg-background text-[9px] font-semibold">
                      {navigationItem.initials}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[13px] leading-5 font-medium">
                        {navigationItem.title}
                      </span>
                      <span className="text-[12px] leading-4 text-muted">
                        {navigationItem.description}
                      </span>
                    </span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
