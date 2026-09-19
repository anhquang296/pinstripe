import type { LoginFormData } from '@common/forms/login-form';
import { Button, FieldError, Input, Label, TextField } from '@heroui/react';
import { get } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface LoginFormProps {
  form: UseFormReturn<LoginFormData>;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export default function LoginForm({ form, isSubmitting, onSubmit }: LoginFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => {
          const errorMessage = get(fieldState, 'error.message');

          return (
            <TextField
              className="flex flex-col gap-1"
              name={field.name}
              value={field.value}
              isInvalid={Boolean(errorMessage)}
              isDisabled={isSubmitting}
              onBlur={field.onBlur}
              onChange={field.onChange}
            >
              <Label>Email thanh toán</Label>
              <Input
                ref={field.ref}
                type="email"
                autoComplete="email"
                placeholder="ketoan@nhaxe.vn"
              />
              <FieldError>{errorMessage}</FieldError>
            </TextField>
          );
        }}
      />

      <Button type="submit" isPending={isSubmitting} className="w-full">
        Gửi link đăng nhập
      </Button>
    </form>
  );
}
