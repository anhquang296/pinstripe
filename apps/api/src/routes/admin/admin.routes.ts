import { verifyAdminRequest } from '@hooks/verify-admin-request';
import { PermissionEnum } from '@pinstripe/core/contracts';
import { idempotencyPlugin } from '@plugins/idempotency.plugin';
import { rateLimitPlugin } from '@plugins/rate-limit.plugin';
import { apiKeysRoutes } from '@routes/admin/api-keys/api-keys.routes';
import { ledgerRoutes } from '@routes/admin/ledger/ledger.routes';
import { reportingRoutes } from '@routes/admin/reporting/reporting.routes';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import { buildRouteConfig } from '@utils/route-permission';
import type { FastifyInstance } from 'fastify';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyAdminRequest);

  await fastify.register(rateLimitPlugin);
  await fastify.register(idempotencyPlugin);
  await fastify.register(apiKeysRoutes, { prefix: '/api_keys' });
  await fastify.register(ledgerRoutes, { prefix: '/ledger' });
  await fastify.register(reportingRoutes, { prefix: '/reporting' });

  fastify.get(
    '/ping',
    {
      config: buildRouteConfig(PermissionEnum.BILLING_READ),
      schema: { response: { 200: Type.Object({ now: Type.String() }) } },
    },
    async (_request, reply) => {
      return ApiResponse.success(reply, { now: fastify.clock.now().toISOString() });
    },
  );
}
