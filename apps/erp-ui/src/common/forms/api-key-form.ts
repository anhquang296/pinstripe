import { zodResolver } from '@hookform/resolvers/zod';
import type { ErpModule } from '@vxrerp/platform/contracts';
import { ApiKeyTypeEnum, PermissionEnum } from '@vxrerp/platform/contracts';
import type { CreateApiKeyPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const apiKeyFormSchema = z.object({
  name: z.string().min(1, 'Tên khoá là bắt buộc'),
  type: z.nativeEnum(ApiKeyTypeEnum, { message: 'Chọn loại khoá' }),
  permissions: z.array(z.nativeEnum(PermissionEnum)).min(1, 'Chọn ít nhất một quyền'),
});

export type ApiKeyFormData = z.infer<typeof apiKeyFormSchema>;

export const apiKeyFormResolver = zodResolver(apiKeyFormSchema);

export const apiKeyFormDefaultValues: ApiKeyFormData = {
  name: '',
  type: ApiKeyTypeEnum.SECRET,
  permissions: [PermissionEnum.BILLING_READ],
};

export function apiKeyFormDataToPayload(
  formData: ApiKeyFormData,
  module: ErpModule,
): CreateApiKeyPayload {
  return {
    name: formData.name,
    module,
    type: formData.type,
    permissions: formData.permissions,
  };
}
