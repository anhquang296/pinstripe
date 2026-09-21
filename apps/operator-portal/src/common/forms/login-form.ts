import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginFormSchema = z.object({
  email: z.string().trim().min(1, 'Nhập email thanh toán của nhà xe').email('Email không hợp lệ'),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;
export const loginFormResolver = zodResolver(loginFormSchema);
export const loginFormDefaultValues: LoginFormData = { email: '' };
