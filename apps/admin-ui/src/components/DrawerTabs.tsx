import { Tabs } from '@heroui/react';
import { map, toString } from 'lodash-es';

interface DrawerTabsItem {
  key: string;
  label: string;
}

interface DrawerTabsProps {
  items: DrawerTabsItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export default function DrawerTabs({ items, activeKey, onSelect }: DrawerTabsProps) {
  return (
    <Tabs
      variant="secondary"
      selectedKey={activeKey}
      onSelectionChange={(key) => {
        onSelect(toString(key));
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Các phần của drawer">
          {map(items, (item) => {
            return (
              <Tabs.Tab key={item.key} id={item.key} className="whitespace-nowrap">
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
