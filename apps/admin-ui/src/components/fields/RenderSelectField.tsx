import { FieldError, Label, ListBox, Select } from '@heroui/react';
import { cn } from '@lib/cn';
import { get, map, toString } from 'lodash-es';
import type { Key } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface RenderSelectFieldOption {
  value: string;
  label: string;
}

interface RenderSelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: RenderSelectFieldOption[];
  className?: string;
  isDisabled?: boolean;
}

const EMPTY_OPTION_KEY = '__empty__';

function toOptionKey(value: string): string {
  if (value === '') {
    return EMPTY_OPTION_KEY;
  }

  return value;
}

function toOptionValue(key: Key | null): string {
  if (key === null || key === EMPTY_OPTION_KEY) {
    return '';
  }

  return toString(key);
}

export default function RenderSelectField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  className,
  isDisabled,
}: RenderSelectFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = get(fieldState, 'error.message');

        return (
          <Select
            className={cn('flex flex-col gap-1', className)}
            name={field.name}
            selectedKey={toOptionKey(toString(field.value))}
            isDisabled={isDisabled}
            isInvalid={Boolean(errorMessage)}
            onBlur={field.onBlur}
            onSelectionChange={(key) => {
              field.onChange(toOptionValue(key));
            }}
          >
            <Label>{label}</Label>
            <Select.Trigger ref={field.ref}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <FieldError>{errorMessage}</FieldError>
            <Select.Popover>
              <ListBox>
                {map(options, (option) => {
                  return (
                    <ListBox.Item key={option.value} id={toOptionKey(option.value)}>
                      {option.label}
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </Select.Popover>
          </Select>
        );
      }}
    />
  );
}
