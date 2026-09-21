import { Label, ListBox, Select } from '@heroui/react';
import { isNull, map, toString } from 'lodash-es';

interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  placeholder: string;
  options: FilterSelectOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
}

export default function FilterSelect({
  label,
  placeholder,
  options,
  selectedValue,
  onSelect,
}: FilterSelectProps) {
  return (
    <Select
      className="w-56"
      placeholder={placeholder}
      selectedKey={selectedValue}
      onClear={() => {
        onSelect(null);
      }}
      onSelectionChange={(key) => {
        onSelect(isNull(key) ? null : toString(key));
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.ClearButton />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {map(options, (option) => {
            return (
              <ListBox.Item key={option.value} id={option.value}>
                {option.label}
              </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
