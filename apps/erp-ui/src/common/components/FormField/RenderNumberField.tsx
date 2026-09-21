import { FieldError, Label, NumberField } from '@heroui/react';
import { cn } from '@libs/cn';
import { get, isNumber } from 'lodash-es';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface RenderNumberFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  minValue?: number;
  maxValue?: number;
  className?: string;
  isDisabled?: boolean;
}

export default function RenderNumberField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  minValue,
  maxValue,
  className,
  isDisabled,
}: RenderNumberFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = get(fieldState, 'error.message');
        const value = isNumber(field.value) ? field.value : Number.NaN;

        return (
          <NumberField
            className={cn('flex flex-col gap-1', className)}
            name={field.name}
            value={value}
            minValue={minValue}
            maxValue={maxValue}
            formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
            isDisabled={isDisabled}
            isInvalid={Boolean(errorMessage)}
            onBlur={field.onBlur}
            onChange={(nextValue) => {
              field.onChange(Number.isNaN(nextValue) ? null : nextValue);
            }}
          >
            <Label>{label}</Label>
            <NumberField.Group>
              <NumberField.Input ref={field.ref} />
            </NumberField.Group>
            <FieldError>{errorMessage}</FieldError>
          </NumberField>
        );
      }}
    />
  );
}
