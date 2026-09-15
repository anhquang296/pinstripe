import { cn } from '@lib/cn';
import { map } from 'lodash-es';
import { useCallback } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/customers', label: 'Customers' },
  { to: '/products', label: 'Products' },
  { to: '/prices', label: 'Prices' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/meters', label: 'Meters' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/test-clocks', label: 'Test clocks' },
];

export default function AppLayout() {
  const handleOnNavLinkClassName = useCallback(({ isActive }: { isActive: boolean }) => {
    return cn(
      'rounded-md px-3 py-1.5 text-sm font-medium',
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50',
    );
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Pinstripe</span>
          <nav className="flex gap-1">
            {map(NAV_ITEMS, (navItem) => {
              return (
                <NavLink key={navItem.to} to={navItem.to} className={handleOnNavLinkClassName}>
                  {navItem.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
