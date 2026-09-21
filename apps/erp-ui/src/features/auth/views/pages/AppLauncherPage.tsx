import { findVisibleNavigationItems } from '@common/utils/navigation';
import { FEATURE_TONE_CLASSES } from '@features/auth/constants/feature-tone';
import { ERP_FEATURES } from '@features/auth/features';
import { Card } from '@heroui/react';
import { cn } from '@libs/cn';
import { usePermissions } from '@libs/permissions';
import { filter, isEmpty, map } from 'lodash-es';
import { Link } from 'react-router-dom';

export default function AppLauncherPage() {
  const permissions = usePermissions();

  const visibleFeatures = filter(ERP_FEATURES, (feature) => {
    return !isEmpty(findVisibleNavigationItems(feature.navigationItems, permissions));
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Ứng dụng</h1>
        <p className="text-muted">Chọn một ứng dụng để bắt đầu làm việc.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {map(visibleFeatures, (feature) => {
          return (
            <Link
              key={feature.homePath}
              to={feature.homePath}
              className="group rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Card className="h-full items-center gap-3 py-6 text-center transition-shadow group-hover:shadow-overlay">
                <span
                  className={cn(
                    'flex size-16 items-center justify-center rounded-2xl [&>svg]:size-8',
                    FEATURE_TONE_CLASSES[feature.tone],
                  )}
                >
                  {feature.icon}
                </span>
                <Card.Header className="items-center gap-1">
                  <Card.Title className="text-[15px] font-semibold">{feature.title}</Card.Title>
                  <Card.Description>{feature.description}</Card.Description>
                </Card.Header>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
