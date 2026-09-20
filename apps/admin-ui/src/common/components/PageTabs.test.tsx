import { cleanup, render, screen } from '@testing-library/react';
import { find, get, map } from 'lodash-es';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { PageTabsItem } from './PageTabs';
import PageTabs from './PageTabs';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
});

function setup(items: PageTabsItem[], pathname: string) {
  const router = createMemoryRouter(
    [{ path: '/invoices/:status', element: <PageTabs items={items} /> }],
    { initialEntries: [pathname] },
  );

  return render(<RouterProvider router={router} />);
}

function findSelectedTabName() {
  const selectedTab = find(screen.getAllByRole('tab'), (tab) => {
    return tab.getAttribute('aria-selected') === 'true';
  });

  return get(selectedTab, 'textContent', null);
}

const INVOICE_TABS: PageTabsItem[] = [
  { to: '/invoices/draft', label: 'Draft · 0' },
  { to: '/invoices/open', label: 'Open · 3' },
  { to: '/invoices/paid', label: 'Paid · 1' },
];

const FILTERED_INVOICE_TABS: PageTabsItem[] = [
  { to: '/invoices/draft', search: '?customerId=cus_1', label: 'Draft · 0' },
  { to: '/invoices/open', search: '?customerId=cus_1', label: 'Open · 3' },
  { to: '/invoices/paid', search: '?customerId=cus_1', label: 'Paid · 1' },
];

describe('PageTabs', () => {
  it('selects the tab matching the current pathname', () => {
    setup(INVOICE_TABS, '/invoices/paid');

    expect(findSelectedTabName()).toBe('Paid · 1');
  });

  it('keeps the selection when the items carry a search string', () => {
    setup(FILTERED_INVOICE_TABS, '/invoices/paid');

    expect(findSelectedTabName()).toBe('Paid · 1');
  });

  it('keeps every tab labelled when the search string changes between renders', () => {
    const { rerender } = setup(INVOICE_TABS, '/invoices/paid');

    const router = createMemoryRouter(
      [{ path: '/invoices/:status', element: <PageTabs items={FILTERED_INVOICE_TABS} /> }],
      { initialEntries: ['/invoices/paid'] },
    );

    rerender(<RouterProvider router={router} />);

    expect(map(screen.getAllByRole('tab'), 'textContent')).toEqual([
      'Draft · 0',
      'Open · 3',
      'Paid · 1',
    ]);
    expect(findSelectedTabName()).toBe('Paid · 1');
  });
});
