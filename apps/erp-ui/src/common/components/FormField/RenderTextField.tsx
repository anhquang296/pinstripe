import { FieldError, Input, Label, TextField } from '@heroui/react';
import { cn } from '@libs/cn';
import { get, toString } from 'lodash-es';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface RenderTextFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  type?: string;
  className?: string;
  isDisabled?: boolean;
}

export default function RenderTextField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = 'text',
  className,
  isDisabled,
}: RenderTextFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = get(fieldState, 'error.message');

        return (
          <TextField
            className={cn('flex flex-col gap-1', className)}
            name={field.name}
            value={toString(field.value)}
            isDisabled={isDisabled}
            isInvalid={Boolean(errorMessage)}
            onBlur={field.onBlur}
            onChange={field.onChange}
          >
            <Label>{label}</Label>
            <Input ref={field.ref} type={type} placeholder={placeholder} />
            <FieldError>{errorMessage}</FieldError>
          </TextField>
        );
      }}
    />
  );
}
