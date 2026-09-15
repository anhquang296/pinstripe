import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ApiResponse } from '@utils/api-response';

export const publicRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/healthz',
    { schema: { response: { 200: Type.Object({ status: Type.String() }) } } },
    async (_request, reply) => {
      return ApiResponse.success(reply, { status: 'ok' });
    },
  );
};
