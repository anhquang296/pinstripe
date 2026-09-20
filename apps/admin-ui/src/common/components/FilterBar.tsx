import { Label, SearchField } from '@heroui/react';
import type { ReactNode } from 'react';

interface FilterBarProps {
  itemCount: number;
  searchValue?: string | null;
  searchPlaceholder?: string;
  onSearchChange?: (searchValue: string) => void;
  children?: ReactNode;
}

export default function FilterBar({
  itemCount,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {onSearchChange ? (
        <SearchField
          className="min-w-64 flex-1"
          value={searchValue ?? ''}
          onChange={onSearchChange}
        >
          <Label>Tìm kiếm</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      ) : null}

      {children}

      <span className="ml-auto pb-2 text-app-label text-[12px]">{itemCount} mục</span>
    </div>
  );
}
