import { SearchField } from '@heroui/react';
import type { ReactNode } from 'react';

interface FilterBarProps {
  itemCount: number;
  searchValue?: string;
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
    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
      <span className="text-app-label text-[12px]">{itemCount} mục</span>

      {children}

      {onSearchChange ? (
        <SearchField
          className="ml-auto w-64"
          value={searchValue}
          aria-label="Tìm kiếm"
          onChange={onSearchChange}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      ) : null}
    </div>
  );
}
