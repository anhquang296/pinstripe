import { Checkbox, CheckboxGroup, FieldError, Label } from '@heroui/react';
import { cn } from '@lib/cn';
import { castArray, get, map, toString } from 'lodash-es';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface RenderCheckboxGroupFieldOption {
  value: string;
  label: string;
}

interface RenderCheckboxGroupFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: RenderCheckboxGroupFieldOption[];
  className?: string;
  isDisabled?: boolean;
}

export default function RenderCheckboxGroupField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  options,
  className,
  isDisabled,
}: RenderCheckboxGroupFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = get(fieldState, 'error.message');
        const selectedValues = map(castArray(get(field, 'value', [])), toString);

        return (
          <CheckboxGroup
            className={cn('flex flex-col gap-2', className)}
            name={field.name}
            value={selectedValues}
            isDisabled={isDisabled}
            isInvalid={Boolean(errorMessage)}
            onBlur={field.onBlur}
            onChange={field.onChange}
          >
            <Label>{label}</Label>
            <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {map(options, (option) => {
                return (
                  <Checkbox key={option.value} value={option.value}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className="text-[12px]">{option.label}</span>
                    </Checkbox.Content>
                  </Checkbox>
                );
              })}
            </div>
            <FieldError>{errorMessage}</FieldError>
          </CheckboxGroup>
        );
      }}
    />
  );
}
