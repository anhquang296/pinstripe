import { TooManyRequestsError } from '@pinstripe/core/errors';
import { consumeRateLimit, RedisNamespaceEnum } from '@pinstripe/core/utils';
import { readAuth } from '@utils/request-auth';
import fp from 'fastify-plugin';

export const rateLimitPlugin = fp(async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const { apiRateLimit, apiRateWindowSeconds } = fastify.workflowSchedules;
    const { apiKeyId } = readAuth(request);

    const key = fastify.redisKeyFactory.build(RedisNamespaceEnum.API_RATE_LIMIT, apiKeyId);

    const { limit, remaining, resetSeconds, isAllowed } = await consumeRateLimit(
      fastify.redis,
      key,
      {
        limit: apiRateLimit,
        windowSeconds: apiRateWindowSeconds,
      },
    );

    reply.header('ratelimit-limit', String(limit));
    reply.header('ratelimit-remaining', String(remaining));
    reply.header('ratelimit-reset', String(resetSeconds));

    if (isAllowed) {
      return;
    }

    throw new TooManyRequestsError(
      `This API key has made too many requests; retry in ${resetSeconds} seconds`,
    );
  });
});
