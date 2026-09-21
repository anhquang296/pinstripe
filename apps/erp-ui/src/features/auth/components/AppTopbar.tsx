import { UserButton } from '@better-auth-ui/heroui';
import ReportRangePicker from '@common/components/ReportRangePicker';
import type { FeatureDefinition } from '@common/types/feature-definition';
import { findActiveNavigationItem } from '@common/utils/navigation';
import NotificationButton from '@features/auth/components/NotificationButton';
import { hasReportRange, SETTINGS_FEATURE } from '@features/auth/features';
import { Gear } from '@gravity-ui/icons';
import { Button, Tooltip } from '@heroui/react';
import { cn } from '@libs/cn';
import { useLocation, useNavigate } from 'react-router-dom';

interface AppTopbarProps {
  feature: FeatureDefinition | null;
}

export default function AppTopbar({ feature }: AppTopbarProps) {
  const { pathname } = useLocation();

  const navigate = useNavigate();

  const handleOnSettingsPress = () => {
    navigate(SETTINGS_FEATURE.homePath);
  };

  const renderBreadcrumb = () => {
    if (feature) {
      const activeItem = findActiveNavigationItem(feature.navigationItems, pathname);

      return (
        <span className="text-[13px] text-accent">
          {feature.title}
          {activeItem ? ` / ${activeItem.title}` : null}
        </span>
      );
    }

    return <span className="text-[14px] font-semibold">VXR ERP</span>;
  };

  return (
    <header
      className={cn(
        'border-separator fixed inset-x-0 top-0 z-10 flex h-topbar items-center gap-2 border-b bg-surface px-4',
        feature ? 'left-sidebar' : 'left-0',
      )}
    >
      {renderBreadcrumb()}

      <div className="ml-auto flex items-center gap-3">
        {hasReportRange(pathname) ? <ReportRangePicker /> : null}

        <Tooltip>
          <Button
            isIconOnly
            variant="tertiary"
            aria-label="Cài đặt"
            onPress={handleOnSettingsPress}
          >
            <Gear />
          </Button>
          <Tooltip.Content>Cài đặt</Tooltip.Content>
        </Tooltip>

        <NotificationButton />

        <UserButton size="icon" />
      </div>
    </header>
  );
}
