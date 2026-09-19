import { Label, ListBox, Select } from '@heroui/react';
import { map, toString } from 'lodash-es';

interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  options: FilterSelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export default function FilterSelect({
  label,
  options,
  selectedValue,
  onSelect,
}: FilterSelectProps) {
  return (
    <Select
      className="w-56"
      placeholder={label}
      selectedKey={selectedValue === '' ? null : selectedValue}
      onSelectionChange={(key) => {
        onSelect(toString(key));
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
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
