import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/healthz',
    { schema: { response: { 200: Type.Object({ status: Type.String() }) } } },
    async () => {
      return { status: 'ok' };
    },
  );
}
