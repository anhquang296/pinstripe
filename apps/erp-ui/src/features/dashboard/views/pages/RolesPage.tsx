import DataTable from '@common/components/DataTable';
import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import { OPTION_LIMIT } from '@common/constants/pagination';
import { ROLE_DESCRIPTIONS, ROLE_OPTIONS } from '@common/constants/roles';
import type { Permission, UserRole } from '@vxrerp/platform/contracts';
import { PermissionEnum, ROLE_PERMISSIONS, UserRoleEnum } from '@vxrerp/platform/contracts';
import { useUsersQuery } from '@vxrerp/sdk/react';
import { filter, get, includes, map, size, values } from 'lodash-es';

interface RoleRow {
  id: string;
  role: UserRole;
  description: string;
  permissions: readonly Permission[];
  userCount: number;
}

interface PermissionRow {
  id: Permission;
}

export default function RolesPage() {
  const { data: users, isPending } = useUsersQuery({ limit: OPTION_LIMIT });

  const allUsers = get(users, 'data', []);

  const rows: RoleRow[] = map(ROLE_OPTIONS, (roleOption) => {
    const { value: role } = roleOption;

    return {
      id: role,
      role,
      description: get(ROLE_DESCRIPTIONS, role, ''),
      permissions: get(ROLE_PERMISSIONS, role, []),
      userCount: size(filter(allUsers, { role })),
    };
  });

  const permissionRows: PermissionRow[] = map(values(PermissionEnum), (permission) => {
    return { id: permission };
  });

  return (
    <PageCard
      title="Roles"
      description="Ma trận quyền là hằng số của repo: ROLE_PERMISSIONS trong @vxrerp/platform. Đổi quyền là đổi code, không phải đổi dữ liệu — màn này chỉ đọc."
    >
      <StatGrid>
        <StatItem label="Vai trò" value={size(ROLE_OPTIONS)} />
        <StatItem label="Quyền trong hệ thống" value={size(values(PermissionEnum))} />
        <StatItem
          label="Admin đang hoạt động"
          value={size(filter(allUsers, { role: UserRoleEnum.ADMIN }))}
        />
        <StatItem label="Người dùng đã tải" value={size(allUsers)} />
      </StatGrid>

      <DataTable
        label="Vai trò"
        rows={rows}
        isLoading={isPending}
        columns={[
          {
            key: 'role',
            label: 'Vai trò',
            isRowHeader: true,
            renderCell: (roleRow) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{roleRow.role}</span>
                  <span className="text-app-label text-[11px]">{roleRow.description}</span>
                </div>
              );
            },
          },
          {
            key: 'userCount',
            label: 'Số người dùng',
            renderCell: (roleRow) => {
              return roleRow.userCount;
            },
          },
          {
            key: 'permissionCount',
            label: 'Số quyền',
            renderCell: (roleRow) => {
              return size(roleRow.permissions);
            },
          },
        ]}
      />

      <DataTable
        label="Ma trận quyền"
        rows={permissionRows}
        columns={[
          {
            key: 'permission',
            label: 'Quyền',
            isRowHeader: true,
            renderCell: (permissionRow) => {
              return <span className="font-mono text-xs">{permissionRow.id}</span>;
            },
          },
          ...map(ROLE_OPTIONS, (roleOption) => {
            const rolePermissions = get(ROLE_PERMISSIONS, roleOption.value, []);

            return {
              key: roleOption.value,
              label: roleOption.value,
              renderCell: (permissionRow: PermissionRow) => {
                return includes(rolePermissions, permissionRow.id) ? (
                  <span className="text-success">có</span>
                ) : (
                  <span className="text-muted">—</span>
                );
              },
            };
          }),
        ]}
      />
    </PageCard>
  );
}
