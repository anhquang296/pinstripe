import { zodResolver } from '@hookform/resolvers/zod';
import { ApiKeyScopeEnum, ApiKeyTypeEnum } from '@pinstripe/core/contracts';
import type { CreateApiKeyPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const apiKeyFormSchema = z.object({
  name: z.string().min(1, 'Tên khoá là bắt buộc'),
  type: z.nativeEnum(ApiKeyTypeEnum, { message: 'Chọn loại khoá' }),
  scopes: z.array(z.nativeEnum(ApiKeyScopeEnum)).min(1, 'Chọn ít nhất một scope'),
});

export type ApiKeyFormData = z.infer<typeof apiKeyFormSchema>;

export const apiKeyFormResolver = zodResolver(apiKeyFormSchema);

export const apiKeyFormDefaultValues: ApiKeyFormData = {
  name: '',
  type: ApiKeyTypeEnum.SECRET,
  scopes: [ApiKeyScopeEnum.V1],
};

export function apiKeyFormDataToPayload(formData: ApiKeyFormData): CreateApiKeyPayload {
  return {
    name: formData.name,
    type: formData.type,
    scopes: formData.scopes,
  };
}
