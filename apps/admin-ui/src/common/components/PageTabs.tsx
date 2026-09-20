import { Tabs } from '@heroui/react';
import { find, get, head, map, startsWith, toString } from 'lodash-es';
import { useLocation, useNavigate } from 'react-router-dom';

export interface PageTabsItem {
  to: string;
  search?: string;
  label: string;
}

interface PageTabsProps {
  items: PageTabsItem[];
}

export default function PageTabs({ items }: PageTabsProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeItem = find(items, (item) => {
    return pathname === item.to || startsWith(pathname, `${item.to}/`);
  });

  const activeKey = get(activeItem, 'to', get(head(items), 'to'));

  return (
    <Tabs
      className="w-fit"
      selectedKey={activeKey}
      onSelectionChange={(key) => {
        const nextItem = find(items, { to: toString(key) });

        navigate({ pathname: toString(key), search: get(nextItem, 'search', '') });
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Các tab của màn">
          {map(items, (item) => {
            return (
              <Tabs.Tab key={item.to} id={item.to} className="whitespace-nowrap">
                {item.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
