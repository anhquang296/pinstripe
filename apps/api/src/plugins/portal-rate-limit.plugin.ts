import { createHash } from 'node:crypto';

import { readAuth } from '@utils/request-auth';
import { PORTAL_CLIENT_IP_HEADER } from '@vxrerp/billing/contracts';
import { TooManyRequestsError } from '@vxrerp/platform/errors';
import { consumeRateLimit, RedisNamespaceEnum } from '@vxrerp/platform/utils';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import _ from 'lodash';

function readClientIp(request: FastifyRequest): string {
  const { [PORTAL_CLIENT_IP_HEADER]: forwardedIp } = request.headers;

  if (_.isString(forwardedIp) && !_.isEmpty(forwardedIp)) {
    return forwardedIp;
  }

  return request.ip;
}

function buildBucketIds(request: FastifyRequest): string[] {
  const { apiKeyId } = readAuth(request);

  const routeScope = `${apiKeyId}:${request.routeOptions.url}`;
  const clientIp = readClientIp(request);
  const email = _.get(request.body, 'email');

  if (_.isString(email)) {
    const emailHash = createHash('sha256').update(_.toLower(email)).digest('hex');

    return [`${routeScope}:ip:${clientIp}`, `${routeScope}:email:${emailHash}`];
  }

  return [`${routeScope}:ip:${clientIp}`];
}

export const portalRateLimitPlugin = fp(async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const { portalRateLimit, portalRateWindowSeconds } = fastify.billingSchedules;

    const bucketIds = buildBucketIds(request);

    const rateLimits = await Promise.all(
      _.map(bucketIds, (bucketId) => {
        const key = fastify.redisKeyFactory.build(RedisNamespaceEnum.PORTAL_RATE_LIMIT, bucketId);

        return consumeRateLimit(fastify.redis, key, {
          limit: portalRateLimit,
          windowSeconds: portalRateWindowSeconds,
        });
      }),
    );

    const tightestRateLimit = _.minBy(rateLimits, 'remaining');

    if (tightestRateLimit) {
      reply.header('ratelimit-limit', String(tightestRateLimit.limit));
      reply.header('ratelimit-remaining', String(tightestRateLimit.remaining));
      reply.header('ratelimit-reset', String(tightestRateLimit.resetSeconds));
    }

    if (_.every(rateLimits, 'isAllowed')) {
      return;
    }

    const resetSeconds = _.get(
      _.maxBy(rateLimits, 'resetSeconds'),
      'resetSeconds',
      portalRateWindowSeconds,
    );

    throw new TooManyRequestsError(
      `Too many portal sign-in attempts; retry in ${resetSeconds} seconds`,
    );
  });
});
