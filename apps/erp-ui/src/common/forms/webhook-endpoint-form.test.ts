import {
  DomainEventTypeEnum,
  ErpModuleEnum,
  WebhookEndpointStatusEnum,
} from '@vxrerp/platform/contracts';
import type { WebhookEndpointResponse } from '@vxrerp/sdk';
import { describe, expect, it } from 'vitest';

import {
  webhookEndpointFormDataToPayload,
  webhookEndpointFormDataToUpdatePayload,
  webhookEndpointToFormData,
} from './webhook-endpoint-form';

function makeWebhookEndpoint(
  overrides: Partial<WebhookEndpointResponse> = {},
): WebhookEndpointResponse {
  return {
    id: 'whe_1',
    module: ErpModuleEnum.BILLING,
    url: 'http://localhost:4100/hooks',
    status: WebhookEndpointStatusEnum.ENABLED,
    enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
    description: 'Hệ thống kế toán',
    secret: null,
    metadata: {},
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('webhookEndpointToFormData', () => {
  it('giữ trạng thái của endpoint khi trạng thái là giá trị hợp lệ', () => {
    const result = webhookEndpointToFormData(
      makeWebhookEndpoint({ status: WebhookEndpointStatusEnum.DISABLED }),
    );

    expect(result.status).toBe(WebhookEndpointStatusEnum.DISABLED);
  });

  it('mang đủ url, mô tả và danh sách event sang form', () => {
    const result = webhookEndpointToFormData(makeWebhookEndpoint());

    expect(result).toEqual({
      url: 'http://localhost:4100/hooks',
      description: 'Hệ thống kế toán',
      enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
      status: WebhookEndpointStatusEnum.ENABLED,
    });
  });
});

describe('webhookEndpointFormDataToPayload', () => {
  it('bỏ mô tả khỏi payload tạo mới khi mô tả rỗng', () => {
    const formData = webhookEndpointToFormData(makeWebhookEndpoint({ description: '' }));

    const result = webhookEndpointFormDataToPayload(formData, ErpModuleEnum.BILLING);

    expect(result).toEqual({
      module: ErpModuleEnum.BILLING,
      url: 'http://localhost:4100/hooks',
      enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
      description: undefined,
    });
  });

  it('không mang url sang payload cập nhật', () => {
    const formData = webhookEndpointToFormData(makeWebhookEndpoint());

    const result = webhookEndpointFormDataToUpdatePayload(formData);

    expect(result).toEqual({
      enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
      description: 'Hệ thống kế toán',
      status: WebhookEndpointStatusEnum.ENABLED,
    });
  });
});
