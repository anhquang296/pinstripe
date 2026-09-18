import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import { ROLE_OPTIONS } from '@constants/roles';
import type { UserFormData } from '@forms/user-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface UserFormProps {
  form: UseFormReturn<UserFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function UserForm({ form, isSaving, onSave }: UserFormProps) {
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
        name="email"
        label="Email"
        placeholder="operator@pinstripe.test"
      />
      <RenderTextField
        control={form.control}
        name="name"
        label="Tên"
        placeholder="Người vận hành"
      />
      <RenderSelectField
        control={form.control}
        name="role"
        label="Vai trò"
        options={ROLE_OPTIONS}
      />
      <RenderTextField
        control={form.control}
        name="password"
        label="Mật khẩu ban đầu"
        type="password"
      />
      <Button type="submit" isDisabled={isSaving}>
        Tạo người dùng
      </Button>
    </form>
  );
}
