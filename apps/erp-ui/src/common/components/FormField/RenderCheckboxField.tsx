import { Checkbox, FieldError } from '@heroui/react';
import { cn } from '@libs/cn';
import { get } from 'lodash-es';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface RenderCheckboxFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  className?: string;
  isDisabled?: boolean;
}

export default function RenderCheckboxField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  className,
  isDisabled,
}: RenderCheckboxFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = get(fieldState, 'error.message');

        return (
          <div className={cn('flex flex-col gap-1', className)}>
            <Checkbox
              ref={field.ref}
              name={field.name}
              isSelected={Boolean(field.value)}
              isDisabled={isDisabled}
              isInvalid={Boolean(errorMessage)}
              onBlur={field.onBlur}
              onChange={field.onChange}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {label}
              </Checkbox.Content>
            </Checkbox>
            <FieldError>{errorMessage}</FieldError>
          </div>
        );
      }}
    />
  );
}
