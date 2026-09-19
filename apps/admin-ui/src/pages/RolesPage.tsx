import DataTable from '@components/DataTable';
import PageCard from '@components/PageCard';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import { OPTION_LIMIT } from '@constants/pagination';
import { ROLE_DESCRIPTIONS, ROLE_OPTIONS } from '@constants/roles';
import type { Permission, UserRole } from '@pinstripe/core/contracts';
import { PermissionEnum, ROLE_PERMISSIONS, UserRoleEnum } from '@pinstripe/core/contracts';
import { useUsersQuery } from '@pinstripe/sdk/react';
import { filter, get, includes, map, size, values } from 'lodash-es';

interface RoleRow {
  id: string;
  role: UserRole;
  description: string;
  permissions: readonly Permission[];
  userCount: number;
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

  return (
    <PageCard
      title="Roles"
      description="Ma trận quyền là hằng số của repo: ROLE_PERMISSIONS trong @pinstripe/core. Đổi quyền là đổi code, không phải đổi dữ liệu — màn này chỉ đọc."
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

      <div className="border-app-border-soft flex flex-col rounded-md border bg-surface">
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
      </div>

      <div className="border-app-border-soft overflow-x-auto rounded-md border bg-surface">
        <table className="w-full min-w-[40rem] text-left text-[12px]">
          <thead className="text-app-description bg-background text-[11px] uppercase">
            <tr>
              <th className="px-3 py-2.5">Quyền</th>
              {map(ROLE_OPTIONS, (roleOption) => {
                return (
                  <th key={roleOption.value} className="px-3 py-2.5 text-center">
                    {roleOption.value}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {map(values(PermissionEnum), (permission) => {
              return (
                <tr key={permission} className="border-app-border-soft border-t">
                  <td className="px-3 py-2.5 font-mono text-[11px]">{permission}</td>
                  {map(ROLE_OPTIONS, (roleOption) => {
                    const rolePermissions = get(ROLE_PERMISSIONS, roleOption.value, []);

                    return (
                      <td key={roleOption.value} className="px-3 py-2.5 text-center">
                        {includes(rolePermissions, permission) ? (
                          <span className="text-success">có</span>
                        ) : (
                          <span className="text-app-description">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageCard>
  );
}
