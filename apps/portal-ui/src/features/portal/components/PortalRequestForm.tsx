import type { PortalRequestFormData } from '@common/forms/portal-request-form';
import { Button, FieldError, Label, TextArea, TextField } from '@heroui/react';
import { get } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';

interface PortalRequestFormProps {
  form: UseFormReturn<PortalRequestFormData>;
  placeholder: string;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export default function PortalRequestForm({
  form,
  placeholder,
  isSubmitting,
  onSubmit,
}: PortalRequestFormProps) {
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
        name="message"
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
              <Label>Nội dung yêu cầu</Label>
              <TextArea ref={field.ref} rows={4} placeholder={placeholder} />
              <FieldError>{errorMessage}</FieldError>
            </TextField>
          );
        }}
      />

      <Button type="submit" isPending={isSubmitting}>
        Gửi yêu cầu
      </Button>
    </form>
  );
}
