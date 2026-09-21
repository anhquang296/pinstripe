import { toEnumMember } from '@common/utils/enum';
import { zodResolver } from '@hookform/resolvers/zod';
import { DomainEventTypeEnum, WebhookEndpointStatusEnum } from '@vxrerp/core/contracts';
import type {
  CreateWebhookEndpointPayload,
  UpdateWebhookEndpointPayload,
  WebhookEndpointResponse,
} from '@vxrerp/sdk';
import { z } from 'zod';

const webhookEndpointFormSchema = z.object({
  url: z.string().min(1, 'URL là bắt buộc'),
  description: z.string(),
  enabledEvents: z.array(z.string()).min(1, 'Chọn ít nhất một event'),
  status: z.nativeEnum(WebhookEndpointStatusEnum, { message: 'Chọn trạng thái' }),
});

export type WebhookEndpointFormData = z.infer<typeof webhookEndpointFormSchema>;

export const webhookEndpointFormResolver = zodResolver(webhookEndpointFormSchema);

export const webhookEndpointFormDefaultValues: WebhookEndpointFormData = {
  url: '',
  description: '',
  enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
  status: WebhookEndpointStatusEnum.ENABLED,
};

export function webhookEndpointToFormData(
  webhookEndpoint: WebhookEndpointResponse,
): WebhookEndpointFormData {
  return {
    url: webhookEndpoint.url,
    description: webhookEndpoint.description,
    enabledEvents: webhookEndpoint.enabledEvents,
    status: toEnumMember(
      WebhookEndpointStatusEnum,
      webhookEndpoint.status,
      WebhookEndpointStatusEnum.ENABLED,
    ),
  };
}

export function webhookEndpointFormDataToPayload(
  formData: WebhookEndpointFormData,
): CreateWebhookEndpointPayload {
  return {
    url: formData.url,
    enabledEvents: formData.enabledEvents,
    description: formData.description || undefined,
  };
}

export function webhookEndpointFormDataToUpdatePayload(
  formData: WebhookEndpointFormData,
): UpdateWebhookEndpointPayload {
  return {
    enabledEvents: formData.enabledEvents,
    description: formData.description,
    status: formData.status,
  };
}
