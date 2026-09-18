import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { bootstrapUserSchema, UserRoleEnum, userSchema } from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const usersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/bootstrap',
    { schema: { body: bootstrapUserSchema, response: { 200: userSchema } } },
    async (request, reply) => {
      const user = await fastify.userService.ensureUser({
        ...request.body,
        role: UserRoleEnum.ADMIN,
      });

      return ApiResponse.success(reply, user);
    },
  );
};
