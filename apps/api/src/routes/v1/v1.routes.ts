import { verifyApiRequest } from '@hooks/verify-api-request';
import { idempotencyPlugin } from '@plugins/idempotency.plugin';
import { customersRoutes } from '@routes/v1/customers/customers.routes';
import { entitlementsRoutes } from '@routes/v1/entitlements/entitlements.routes';
import { invoicesRoutes } from '@routes/v1/invoices/invoices.routes';
import { meterEventsRoutes } from '@routes/v1/meter-events/meter-events.routes';
import { metersRoutes } from '@routes/v1/meters/meters.routes';
import { pricesRoutes } from '@routes/v1/prices/prices.routes';
import { productsRoutes } from '@routes/v1/products/products.routes';
import { subscriptionsRoutes } from '@routes/v1/subscriptions/subscriptions.routes';
import { testClocksRoutes } from '@routes/v1/test-clocks/test-clocks.routes';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import type { FastifyInstance } from 'fastify';

export async function v1Routes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyApiRequest);

  await fastify.register(idempotencyPlugin);

  await fastify.register(customersRoutes, { prefix: '/customers' });
  await fastify.register(productsRoutes, { prefix: '/products' });
  await fastify.register(pricesRoutes, { prefix: '/prices' });
  await fastify.register(subscriptionsRoutes, { prefix: '/subscriptions' });
  await fastify.register(entitlementsRoutes, { prefix: '/entitlements' });
  await fastify.register(invoicesRoutes, { prefix: '/invoices' });
  await fastify.register(metersRoutes, { prefix: '/billing/meters' });
  await fastify.register(meterEventsRoutes, { prefix: '/billing' });
  await fastify.register(testClocksRoutes, { prefix: '/test_helpers/test_clocks' });

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String(), now: Type.String() }) } } },
    async (_request, reply) => {
      return ApiResponse.success(reply, { object: 'ping', now: fastify.clock.now().toISOString() });
    },
  );
}
