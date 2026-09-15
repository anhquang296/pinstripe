import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { idempotencyHook } from '@hooks/idempotency.hook';
import { verifyAdminRequest } from '@hooks/verify-admin-request';
import { ledgerRoutes } from '@routes/admin/ledger/ledger.routes';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyAdminRequest);

  await fastify.register(idempotencyHook);
  await fastify.register(ledgerRoutes, { prefix: '/ledger' });

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String() }) } } },
    async () => {
      return { object: 'admin_ping' };
    },
  );
}
