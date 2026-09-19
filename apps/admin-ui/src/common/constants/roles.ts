import { UserRoleEnum } from '@pinstripe/core/contracts';

export const ROLE_OPTIONS = [
  { value: UserRoleEnum.ADMIN, label: 'admin — toàn quyền' },
  { value: UserRoleEnum.MODERATOR, label: 'moderator — vận hành hằng ngày' },
  { value: UserRoleEnum.MEMBER, label: 'member — chỉ đọc' },
];

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  [UserRoleEnum.ADMIN]: 'Toàn quyền, gồm quản trị người dùng và API key.',
  [UserRoleEnum.MODERATOR]: 'Vận hành hằng ngày: khách hàng, danh mục, thuê bao, hoá đơn.',
  [UserRoleEnum.MEMBER]: 'Chỉ đọc dữ liệu billing.',
};
