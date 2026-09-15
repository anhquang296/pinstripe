import { verifyAdminRequest } from '@hooks/verify-admin-request';
import { idempotencyPlugin } from '@plugins/idempotency.plugin';
import { ledgerRoutes } from '@routes/admin/ledger/ledger.routes';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';
import type { FastifyInstance } from 'fastify';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyAdminRequest);

  await fastify.register(idempotencyPlugin);
  await fastify.register(ledgerRoutes, { prefix: '/ledger' });

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String() }) } } },
    async (_request, reply) => {
      return ApiResponse.success(reply, { object: 'admin_ping' });
    },
  );
}
