import type {
  CreatePortalRequestPayload,
  PortalRequestKind,
  PortalRequestResponse,
} from '@contracts/portal.types';
import { PortalRequestKindEnum } from '@contracts/portal.types';
import { TooManyRequestsError } from '@errors/app.error';
import type { NotificationKind } from '@queues/notification.queue';
import { NotificationKindEnum } from '@queues/notification.queue';
import { consumeRateLimit } from '@utils/rate-limit';
import { RedisNamespaceEnum } from '@utils/redis-key-factory';
import type { FastifyInstance } from 'fastify';

export interface PortalRequestConfig {
  billingOpsEmail: string | null;
}

const NOTIFICATION_KINDS: Record<PortalRequestKind, NotificationKind> = {
  [PortalRequestKindEnum.PLAN_CHANGE]: NotificationKindEnum.PORTAL_PLAN_CHANGE_REQUEST,
  [PortalRequestKindEnum.PROFILE_UPDATE]: NotificationKindEnum.PORTAL_PROFILE_UPDATE_REQUEST,
};

export class PortalRequestService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly portalRequestConfig: PortalRequestConfig,
  ) {}

  async createPortalRequest(
    customerId: string,
    payload: CreatePortalRequestPayload,
  ): Promise<PortalRequestResponse> {
    await this.assertRequestAllowed(customerId);

    const { billingOpsEmail } = this.portalRequestConfig;
    const submittedAt = this.fastify.clock.now().toISOString();

    if (billingOpsEmail) {
      await this.fastify.notificationService.sendNotification({
        kind: NOTIFICATION_KINDS[payload.kind],
        customerId,
        invoiceId: null,
        paymentIntentId: null,
        url: null,
        recipient: billingOpsEmail,
        message: payload.message,
        dedupeKey: `${customerId}:${submittedAt}`,
      });

      this.fastify.log.info(
        { customerId, kind: payload.kind },
        '[PortalRequestService] createPortalRequest() success',
      );

      return { kind: payload.kind, submittedAt };
    }

    this.fastify.log.warn(
      { customerId, kind: payload.kind },
      '[PortalRequestService] createPortalRequest() skipped, BILLING_OPS_EMAIL is not configured',
    );

    return { kind: payload.kind, submittedAt };
  }

  private async assertRequestAllowed(customerId: string): Promise<void> {
    const REQUEST_LIMIT = 5;
    const REQUEST_WINDOW_SECONDS = 3600;

    const key = this.fastify.redisKeyFactory.build(
      RedisNamespaceEnum.PORTAL_RATE_LIMIT,
      `request:${customerId}`,
    );
    const { isAllowed, resetSeconds } = await consumeRateLimit(this.fastify.redis, key, {
      limit: REQUEST_LIMIT,
      windowSeconds: REQUEST_WINDOW_SECONDS,
    });

    if (isAllowed) {
      return;
    }

    throw new TooManyRequestsError(
      `This operator has sent too many requests; retry in ${resetSeconds} seconds`,
    );
  }
}
