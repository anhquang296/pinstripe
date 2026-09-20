import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { accountSchema } from '@pinstripe/core/contracts';
import { ForbiddenError } from '@pinstripe/core/errors';
import { ApiResponse } from '@utils/api-response';

export const accountRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    { schema: { operationId: 'account.get', response: { 200: accountSchema } } },
    async (request, reply) => {
      const { actor } = request;

      if (actor) {
        const account = await fastify.userService.getAccount(actor.userId);

        return ApiResponse.success(reply, account);
      }

      throw new ForbiddenError('Only a signed-in dashboard session has an account to read');
    },
  );
};
