import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { verifyApiRequest } from '@hooks/verify-api-request';
import { idempotencyHook } from '@hooks/idempotency.hook';
import { customersRoutes } from '@routes/v1/customers/customers.routes';
import { pricesRoutes } from '@routes/v1/prices/prices.routes';
import { productsRoutes } from '@routes/v1/products/products.routes';

export async function v1Routes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyApiRequest);

  await fastify.register(idempotencyHook);

  await fastify.register(customersRoutes, { prefix: '/customers' });
  await fastify.register(productsRoutes, { prefix: '/products' });
  await fastify.register(pricesRoutes, { prefix: '/prices' });

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String(), now: Type.String() }) } } },
    async () => {
      return { object: 'ping', now: fastify.clock.now().toISOString() };
    },
  );
}
