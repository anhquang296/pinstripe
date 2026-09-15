import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { verifyAdminRequest } from '@hooks/verify-admin-request';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyAdminRequest);

  fastify.get(
    '/ping',
    { schema: { response: { 200: Type.Object({ object: Type.String() }) } } },
    async () => {
      return { object: 'admin_ping' };
    },
  );
}
