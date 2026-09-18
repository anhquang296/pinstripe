import { zodResolver } from '@hookform/resolvers/zod';
import { UserRoleEnum } from '@pinstripe/core/contracts';
import type { CreateUserPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const userFormSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
  name: z.string().min(1, 'Tên là bắt buộc'),
  role: z.nativeEnum(UserRoleEnum, { message: 'Chọn vai trò' }),
  password: z.string().min(12, 'Mật khẩu tối thiểu 12 ký tự'),
});

export type UserFormData = z.infer<typeof userFormSchema>;

export const userFormResolver = zodResolver(userFormSchema);

export const userFormDefaultValues: UserFormData = {
  email: '',
  name: '',
  role: UserRoleEnum.MEMBER,
  password: '',
};

export function userFormDataToPayload(formData: UserFormData): CreateUserPayload {
  return {
    email: formData.email,
    name: formData.name,
    role: formData.role,
    password: formData.password,
  };
}
