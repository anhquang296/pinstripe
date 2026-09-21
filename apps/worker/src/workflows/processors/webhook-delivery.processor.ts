import { WebhookDeliveryFailedError } from '@type/errors';
import type { WebhookDeliveryJob } from '@vxrerp/platform/queues';
import { WEBHOOK_SIGNATURE_HEADER } from '@vxrerp/platform/utils';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

interface DeliveryOutcome {
  responseStatus: number | null;
  error: string | null;
}

export class WebhookDeliveryProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<WebhookDeliveryJob>): Promise<void> {
    const { deliveryId } = job.data;

    const attempt = await this.fastify.webhookService.resolveDeliveryAttempt(deliveryId);
    const attemptCount = job.attemptsMade + 1;

    const outcome = await this.handleEndpointPost(
      attempt.endpointUrl,
      attempt.body,
      attempt.signature,
    );

    await this.fastify.webhookService.recordDeliveryResult(deliveryId, {
      responseStatus: outcome.responseStatus,
      error: outcome.error,
      attemptCount,
    });

    if (!outcome.error) {
      return;
    }

    this.fastify.log.warn(
      { deliveryId, attemptCount, responseStatus: outcome.responseStatus, error: outcome.error },
      '[WebhookDeliveryProcessor] handle() delivery attempt did not succeed',
    );

    throw new WebhookDeliveryFailedError(deliveryId, outcome.error);
  }

  private async handleEndpointPost(
    url: string,
    body: string,
    signature: string,
  ): Promise<DeliveryOutcome> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature,
        },
        body,
        signal: AbortSignal.timeout(this.fastify.workflowSchedules.webhookTimeoutMs),
      });

      if (response.ok) {
        return { responseStatus: response.status, error: null };
      }

      return { responseStatus: response.status, error: `endpoint answered ${response.status}` };
    } catch (error) {
      return { responseStatus: null, error: String(error) };
    }
  }
}
