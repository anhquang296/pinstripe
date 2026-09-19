import RenderTextField from '@components/fields/RenderTextField';
import type { UserPasswordFormData } from '@forms/user-password-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface UserPasswordFormProps {
  form: UseFormReturn<UserPasswordFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function UserPasswordForm({ form, isSaving, onSave }: UserPasswordFormProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="password"
        label="Mật khẩu mới"
        type="password"
      />
      <Button type="submit" isDisabled={isSaving}>
        Đặt lại mật khẩu
      </Button>
    </form>
  );
}
