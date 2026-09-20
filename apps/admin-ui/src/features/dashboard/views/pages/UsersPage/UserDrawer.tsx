import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import { ROLE_DESCRIPTIONS } from '@common/constants/roles';
import type { UserPasswordFormData } from '@common/forms/user-password-form';
import {
  userPasswordFormDataToPayload,
  userPasswordFormDefaultValues,
  userPasswordFormResolver,
} from '@common/forms/user-password-form';
import { formatDate } from '@common/utils/format';
import UserPasswordForm from '@features/dashboard/components/UserPasswordForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { PermissionEnum, ROLE_PERMISSIONS, UserRoleEnum } from '@pinstripe/core/contracts';
import { useUpdateUserMutation, useUserQuery } from '@pinstripe/sdk/react';
import { get, join, size } from 'lodash-es';
import { useForm } from 'react-hook-form';

interface UserDrawerProps {
  userId: string;
  onClose: () => void;
}

export default function UserDrawer({ userId, onClose }: UserDrawerProps) {
  const canManage = useCan(PermissionEnum.USER_MANAGE);

  const { data: user } = useUserQuery(userId);

  const { mutateAsync: updateUser, isPending: isSaving } = useUpdateUserMutation({
    successMessage: 'Đã đặt lại mật khẩu.',
  });

  const form = useForm<UserPasswordFormData>({
    resolver: userPasswordFormResolver,
    defaultValues: userPasswordFormDefaultValues,
  });

  const role = get(user, 'role', UserRoleEnum.MEMBER);
  const permissions = get(ROLE_PERMISSIONS, role, []);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updateUser({ id: userId, payload: userPasswordFormDataToPayload(formData) });
    form.reset(userPasswordFormDefaultValues);
  });

  return (
    <EntityDrawer
      isOpen
      title={get(user, 'name', userId)}
      description={get(user, 'email', userId)}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Vai trò', value: role },
              {
                label: 'Trạng thái',
                value: <StatusChip status={get(user, 'status', 'disabled')} />,
              },
              { label: 'Số quyền', value: size(permissions) },
              { label: 'Mô tả vai trò', value: get(ROLE_DESCRIPTIONS, role, '—') },
              { label: 'Tạo lúc', value: formatDate(get(user, 'createdAt', '')) },
              { label: 'Cập nhật lúc', value: formatDate(get(user, 'updatedAt', '')) },
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Quyền theo vai trò">
          <p className="text-app-label font-mono text-[11px]">{join(permissions, ', ')}</p>
        </DrawerSection>

        {canManage ? (
          <DrawerSection title="Đặt lại mật khẩu">
            <UserPasswordForm form={form} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
