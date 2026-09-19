import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { UserFormData } from '@common/forms/user-form';
import {
  userFormDataToPayload,
  userFormDefaultValues,
  userFormResolver,
} from '@common/forms/user-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { toEnumMember } from '@common/utils/enum';
import { formatDate } from '@common/utils/format';
import UserForm from '@features/dashboard/components/UserForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { UserResponse, UserRole } from '@pinstripe/core/contracts';
import { PermissionEnum, UserRoleEnum, UserStatusEnum } from '@pinstripe/core/contracts';
import { useCreateUserMutation, useUpdateUserMutation, useUsersQuery } from '@pinstripe/sdk/react';
import { filter, get, includes, last, size, toLower } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import UserDrawer from './UserDrawer';
import UserRoleChips from './UserRoleChips';

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả vai trò' },
  { value: UserRoleEnum.ADMIN, label: 'admin' },
  { value: UserRoleEnum.MODERATOR, label: 'moderator' },
  { value: UserRoleEnum.MEMBER, label: 'member' },
];

export default function UsersPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canManage = useCan(PermissionEnum.USER_MANAGE);

  const { data: users, isPending } = useUsersQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      role:
        roleFilter === 'all'
          ? undefined
          : toEnumMember(UserRoleEnum, roleFilter, UserRoleEnum.MEMBER),
    },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createUser, isPending: isSaving } = useCreateUserMutation({
    successMessage: 'Đã tạo người dùng.',
  });
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUserMutation({
    successMessage: 'Đã cập nhật người dùng.',
  });

  const form = useForm<UserFormData>({
    resolver: userFormResolver,
    defaultValues: userFormDefaultValues,
  });

  const allRows = get(users, 'data', []);
  const hasMore = get(users, 'hasMore', false);
  const searchText = toLower(searchTerm);
  const rows = filter(allRows, (user) => {
    if (searchText === '') {
      return true;
    }

    return includes(toLower(user.email), searchText) || includes(toLower(user.name), searchText);
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createUser(userFormDataToPayload(formData));
    form.reset(userFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnRoleFilterSelect = (nextRole: string) => {
    setRoleFilter(nextRole);
    resetPage();
  };

  const handleOnNext = () => {
    const lastUser = last(rows);

    if (lastUser) {
      advancePage(lastUser.id);
    }
  };

  const handleOnRoleChange = (user: UserResponse, role: UserRole) => {
    updateUser({ id: user.id, payload: { role } });
  };

  const handleOnStatusToggle = (user: UserResponse) => {
    const isActive = user.status === UserStatusEnum.ACTIVE;

    updateUser({
      id: user.id,
      payload: { status: isActive ? UserStatusEnum.DISABLED : UserStatusEnum.ACTIVE },
    });
  };

  const handleOnRowAction = (user: UserResponse) => {
    navigate(`/admin/users/${user.id}`);
  };

  return (
    <PageCard
      title="Users"
      description="Người vận hành dashboard. Không xoá user: hạ quyền hay vô hiệu hoá đi qua cập nhật, để luật admin active cuối cùng còn giữ được."
      actions={
        canManage ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo người dùng
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Người dùng trang này" value={size(rows)} />
        <StatItem label="Admin" value={size(filter(rows, { role: UserRoleEnum.ADMIN }))} />
        <StatItem label="Moderator" value={size(filter(rows, { role: UserRoleEnum.MODERATOR }))} />
        <StatItem
          label="Đang vô hiệu hoá"
          value={size(filter(rows, { status: UserStatusEnum.DISABLED }))}
        />
      </StatGrid>

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={searchTerm}
            searchPlaceholder="Tìm theo email hoặc tên"
            onSearchChange={setSearchTerm}
          >
            <FilterSelect
              label="Vai trò"
              options={ROLE_FILTER_OPTIONS}
              selectedValue={roleFilter}
              onSelect={handleOnRoleFilterSelect}
            />
          </FilterBar>
        }
        label="Danh sách người dùng"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        emptyMessage="Chưa có người dùng nào."
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'name',
            label: 'Người dùng',
            isRowHeader: true,
            renderCell: (user) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-app-label font-mono text-[11px]">{user.email}</span>
                </div>
              );
            },
          },
          {
            key: 'role',
            label: 'Vai trò',
            renderCell: (user) => {
              return (
                <UserRoleChips
                  role={user.role}
                  isDisabled={!canManage || isUpdating}
                  onRoleChange={(role) => {
                    handleOnRoleChange(user, role);
                  }}
                />
              );
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (user) => {
              return <StatusChip status={user.status} />;
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (user) => {
              return formatDate(user.createdAt);
            },
          },
          {
            key: 'actions',
            label: 'Thao tác',
            renderCell: (user) => {
              if (!canManage) {
                return '—';
              }

              return (
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={isUpdating}
                  onPress={() => {
                    handleOnStatusToggle(user);
                  }}
                >
                  {user.status === UserStatusEnum.ACTIVE ? 'Vô hiệu hoá' : 'Bật lại'}
                </Button>
              );
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo người dùng"
        description="Mật khẩu ban đầu tối thiểu 12 ký tự; người dùng đổi lại sau khi đăng nhập."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin người dùng">
          <UserForm form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {userId ? (
        <UserDrawer
          userId={userId}
          onClose={() => {
            navigate('/admin/users');
          }}
        />
      ) : null}
    </PageCard>
  );
}
