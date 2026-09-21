import { DomainEventTypeEnum } from '@vxrerp/core/contracts';
import type { FastifyInstance } from 'fastify';

const DEMO_WEBHOOK_URL = 'https://webhook.site/vxrerp-demo';

export async function seedIntegrations(fastify: FastifyInstance): Promise<void> {
  await fastify.webhookService.createWebhookEndpoint({
    url: DEMO_WEBHOOK_URL,
    description: 'Hệ thống kế toán nội bộ Vexere',
    enabledEvents: [
      DomainEventTypeEnum.INVOICE_FINALIZED,
      DomainEventTypeEnum.INVOICE_PAID,
      DomainEventTypeEnum.SUBSCRIPTION_CREATED,
      DomainEventTypeEnum.SUBSCRIPTION_CANCELED,
    ],
  });

  await fastify.billingPortalService.createConfiguration({
    businessName: 'Vexere',
    isDefault: true,
    features: {
      canViewInvoiceHistory: true,
      canUpdatePaymentMethod: true,
      canCancelSubscription: false,
    },
  });
}
