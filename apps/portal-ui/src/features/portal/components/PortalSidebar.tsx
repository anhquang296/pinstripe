'use client';

import { NAVIGATION_ITEMS } from '@features/portal/constants/navigation';
import { cn } from '@libs/cn';
import { map, startsWith } from 'lodash-es';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

export default function PortalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-sidebar flex-col border-r border-separator bg-surface">
      <div className="flex h-topbar items-center gap-2 border-b border-separator px-4">
        <span className="flex size-6 items-center justify-center rounded-sm bg-accent text-[11px] font-semibold text-accent-foreground">
          VX
        </span>
        <span className="font-semibold">Cổng nhà xe</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 py-3">
        {map(NAVIGATION_ITEMS, (navigationItem) => {
          const isActive =
            navigationItem.to === '/' ? pathname === '/' : startsWith(pathname, navigationItem.to);
          const stateClassName = isActive
            ? 'border-l-accent bg-accent-soft text-accent'
            : 'text-foreground';

          return (
            <NextLink
              key={navigationItem.to}
              href={navigationItem.to}
              className={cn('border-l-2 border-transparent px-4 py-2', stateClassName)}
            >
              {navigationItem.title}
            </NextLink>
          );
        })}
      </nav>
    </aside>
  );
}
