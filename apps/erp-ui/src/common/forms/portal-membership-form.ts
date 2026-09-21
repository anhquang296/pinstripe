import { zodResolver } from '@hookform/resolvers/zod';
import { PortalRoleEnum } from '@vxrerp/billing/contracts';
import type { CreatePortalMembershipPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const portalMembershipFormSchema = z.object({
  email: z.string().trim().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
  name: z.string().trim(),
  role: z.nativeEnum(PortalRoleEnum, { message: 'Chọn vai trò' }),
});

export type PortalMembershipFormData = z.infer<typeof portalMembershipFormSchema>;

export const portalMembershipFormResolver = zodResolver(portalMembershipFormSchema);

export const portalMembershipFormDefaultValues: PortalMembershipFormData = {
  email: '',
  name: '',
  role: PortalRoleEnum.ACCOUNTANT,
};

export function portalMembershipFormDataToPayload(
  customerId: string,
  formData: PortalMembershipFormData,
): CreatePortalMembershipPayload {
  return {
    customerId,
    email: formData.email,
    name: formData.name || undefined,
    role: formData.role,
  };
}
