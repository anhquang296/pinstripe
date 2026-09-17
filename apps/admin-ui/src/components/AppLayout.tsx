import { find, get, map, startsWith } from 'lodash-es';
import { type ChangeEvent, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/customers', label: 'Customers' },
  { to: '/products', label: 'Products' },
  { to: '/prices', label: 'Prices' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/meters', label: 'Meters' },
  { to: '/discounts', label: 'Giảm giá' },
  { to: '/rating', label: 'Rating' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/payments', label: 'Payments' },
  { to: '/webhooks', label: 'Webhooks' },
  { to: '/reports', label: 'Reports' },
  { to: '/ledger', label: 'Ledger' },
  { to: '/test-clocks', label: 'Test clocks' },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeNavItem = find(NAV_ITEMS, (navItem) => {
    return startsWith(pathname, navItem.to);
  });

  const activeTo = get(activeNavItem, 'to', '');

  const handleOnNavChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      navigate(event.target.value);
    },
    [navigate],
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Pinstripe</span>
          <select
            aria-label="Navigate"
            className="h-9 min-w-56 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
            value={activeTo}
            onChange={handleOnNavChange}
          >
            {map(NAV_ITEMS, (navItem) => {
              return (
                <option key={navItem.to} value={navItem.to}>
                  {navItem.label}
                </option>
              );
            })}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
