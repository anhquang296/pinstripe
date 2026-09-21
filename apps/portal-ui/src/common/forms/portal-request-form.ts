import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const portalRequestFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Nhập nội dung yêu cầu để kế toán Vexere nắm được')
    .max(1000, 'Nội dung tối đa 1000 ký tự'),
});

export type PortalRequestFormData = z.infer<typeof portalRequestFormSchema>;
export const portalRequestFormResolver = zodResolver(portalRequestFormSchema);
export const portalRequestFormDefaultValues: PortalRequestFormData = { message: '' };
