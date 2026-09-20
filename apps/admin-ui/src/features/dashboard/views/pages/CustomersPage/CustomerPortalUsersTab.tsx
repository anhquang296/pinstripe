import ConfirmDialog from '@common/components/ConfirmDialog';
import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import RowActionButton from '@common/components/RowActionButton';
import type { PortalMembershipFormData } from '@common/forms/portal-membership-form';
import {
  portalMembershipFormDataToPayload,
  portalMembershipFormDefaultValues,
  portalMembershipFormResolver,
} from '@common/forms/portal-membership-form';
import { formatDate } from '@common/utils/format';
import PortalMembershipForm from '@features/dashboard/components/PortalMembershipForm';
import { PORTAL_ROLE_LABELS } from '@features/dashboard/constants/portal-roles';
import { ArrowsRotateRight, TrashBin } from '@gravity-ui/icons';
import { useCan } from '@libs/permissions';
import { PermissionEnum, PortalRoleEnum } from '@pinstripe/core/contracts';
import type { PortalMembershipResponse } from '@pinstripe/sdk';
import {
  useCreatePortalMembershipMutation,
  useDeletePortalMembershipMutation,
  usePortalMembershipsQuery,
  useUpdatePortalMembershipMutation,
} from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface CustomerPortalUsersTabProps {
  customerId: string;
}

export default function CustomerPortalUsersTab({ customerId }: CustomerPortalUsersTabProps) {
  const [removingMembership, setRemovingMembership] = useState<PortalMembershipResponse | null>(
    null,
  );

  const canWrite = useCan(PermissionEnum.CUSTOMER_WRITE);

  const { data: portalMemberships } = usePortalMembershipsQuery({ customerId });

  const { mutateAsync: createPortalMembership, isPending: isInviting } =
    useCreatePortalMembershipMutation({ successMessage: 'Đã mời người dùng vào cổng nhà xe.' });

  const { mutate: updatePortalMembership } = useUpdatePortalMembershipMutation({
    successMessage: 'Đã đổi vai trò.',
  });

  const { mutateAsync: deletePortalMembership, isPending: isRemoving } =
    useDeletePortalMembershipMutation({ successMessage: 'Đã gỡ quyền truy cập.' });

  const form = useForm<PortalMembershipFormData>({
    resolver: portalMembershipFormResolver,
    defaultValues: portalMembershipFormDefaultValues,
  });

  const handleOnInvite = form.handleSubmit(async (formData) => {
    await createPortalMembership(portalMembershipFormDataToPayload(customerId, formData));
    form.reset(portalMembershipFormDefaultValues);
  });

  const handleOnConfirmRemove = async () => {
    if (removingMembership) {
      await deletePortalMembership(removingMembership.id);
      setRemovingMembership(null);
    }
  };

  const handleOnRemoveOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setRemovingMembership(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canWrite ? (
        <DrawerSection title="Mời người dùng">
          <p className="text-[12px] text-muted">
            Người được mời đăng nhập cổng nhà xe bằng link gửi tới chính email của họ. Email thanh
            toán của khách luôn là Chủ xe và không gỡ được ở đây.
          </p>
          <PortalMembershipForm form={form} isSaving={isInviting} onSave={handleOnInvite} />
        </DrawerSection>
      ) : null}

      <DataTable
        label="Người dùng cổng nhà xe"
        rows={get(portalMemberships, 'data', [])}
        emptyMessage="Chưa ai đăng nhập cổng nhà xe của khách này."
        columns={[
          {
            key: 'email',
            label: 'Email',
            isRowHeader: true,
            renderCell: (portalMembership) => {
              return portalMembership.email;
            },
          },
          {
            key: 'name',
            label: 'Họ tên',
            renderCell: (portalMembership) => {
              return portalMembership.name || '—';
            },
          },
          {
            key: 'role',
            label: 'Vai trò',
            renderCell: (portalMembership) => {
              return PORTAL_ROLE_LABELS[portalMembership.role];
            },
          },
          {
            key: 'createdAt',
            label: 'Thêm lúc',
            renderCell: (portalMembership) => {
              return formatDate(portalMembership.createdAt);
            },
          },
          {
            key: 'actions',
            label: 'Thao tác',
            align: 'end',
            renderCell: (portalMembership) => {
              const nextRole =
                portalMembership.role === PortalRoleEnum.OWNER
                  ? PortalRoleEnum.ACCOUNTANT
                  : PortalRoleEnum.OWNER;

              if (canWrite) {
                return (
                  <>
                    <RowActionButton
                      label={`Đổi thành ${PORTAL_ROLE_LABELS[nextRole]}`}
                      icon={<ArrowsRotateRight />}
                      onPress={() => {
                        updatePortalMembership({
                          id: portalMembership.id,
                          payload: { role: nextRole },
                        });
                      }}
                    />
                    <RowActionButton
                      label="Gỡ quyền"
                      icon={<TrashBin />}
                      isDanger
                      onPress={() => {
                        setRemovingMembership(portalMembership);
                      }}
                    />
                  </>
                );
              }

              return null;
            },
          },
        ]}
      />

      <ConfirmDialog
        isOpen={removingMembership !== null}
        title="Gỡ quyền vào cổng nhà xe"
        description={`${get(removingMembership, 'email', '')} sẽ bị đăng xuất khỏi cổng của khách này ngay lập tức.`}
        confirmLabel="Gỡ quyền"
        isConfirming={isRemoving}
        onConfirm={handleOnConfirmRemove}
        onOpenChange={handleOnRemoveOpenChange}
      />
    </div>
  );
}
