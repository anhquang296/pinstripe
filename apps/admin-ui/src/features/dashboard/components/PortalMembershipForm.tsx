import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { PortalMembershipFormData } from '@common/forms/portal-membership-form';
import { PORTAL_ROLE_LABELS } from '@features/dashboard/constants/portal-roles';
import { Button } from '@heroui/react';
import { map, toPairs } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';

interface PortalMembershipFormProps {
  form: UseFormReturn<PortalMembershipFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

const PORTAL_ROLE_OPTIONS = map(toPairs(PORTAL_ROLE_LABELS), ([value, label]) => {
  return { value, label };
});

export default function PortalMembershipForm({
  form,
  isSaving,
  onSave,
}: PortalMembershipFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        placeholder="ketoan@nhaxe.vn"
      />
      <RenderTextField control={form.control} name="name" label="Họ tên" />
      <RenderSelectField
        control={form.control}
        name="role"
        label="Vai trò"
        options={PORTAL_ROLE_OPTIONS}
      />
      <Button type="submit" isDisabled={isSaving}>
        Mời vào cổng nhà xe
      </Button>
    </form>
  );
}
