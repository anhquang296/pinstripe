import { zodResolver } from '@hookform/resolvers/zod';
import type { UpdateUserPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const userPasswordFormSchema = z.object({
  password: z.string().min(12, 'Mật khẩu tối thiểu 12 ký tự'),
});

export type UserPasswordFormData = z.infer<typeof userPasswordFormSchema>;

export const userPasswordFormResolver = zodResolver(userPasswordFormSchema);

export const userPasswordFormDefaultValues: UserPasswordFormData = {
  password: '',
};

export function userPasswordFormDataToPayload(formData: UserPasswordFormData): UpdateUserPayload {
  return {
    password: formData.password,
  };
}
