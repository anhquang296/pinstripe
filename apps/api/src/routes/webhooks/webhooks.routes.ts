import { pspCallbacksRoutes } from '@routes/webhooks/psp/psp-callbacks.routes';
import type { FastifyInstance } from 'fastify';

export async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(pspCallbacksRoutes, { prefix: '/psp' });
}
