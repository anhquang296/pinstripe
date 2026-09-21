import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createUserSchema,
  findUsersSchema,
  ListResponseSchema,
  updateUserSchema,
  userParamsSchema,
  userSchema,
} from '@vxrerp/platform/contracts';

export const usersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        operationId: 'users.find',
        querystring: findUsersSchema,
        response: { 200: ListResponseSchema(userSchema) },
      },
    },
    async (request, reply) => {
      const users = await fastify.userService.findUsers(request.query);

      return ApiResponse.success(reply, users);
    },
  );

  fastify.get(
    '/:userId',
    {
      schema: {
        operationId: 'users.get',
        params: userParamsSchema,
        response: { 200: userSchema },
      },
    },
    async (request, reply) => {
      const user = await fastify.userService.getUser(request.params.userId);

      return ApiResponse.success(reply, user);
    },
  );

  fastify.post(
    '/',
    {
      schema: {
        operationId: 'users.create',
        body: createUserSchema,
        response: { 201: userSchema },
      },
    },
    async (request, reply) => {
      const user = await fastify.userService.createUser(request.body);

      return ApiResponse.created(reply, user);
    },
  );

  fastify.patch(
    '/:userId',
    {
      schema: {
        operationId: 'users.update',
        params: userParamsSchema,
        body: updateUserSchema,
        response: { 200: userSchema },
      },
    },
    async (request, reply) => {
      const user = await fastify.userService.updateUser(request.params.userId, request.body);

      return ApiResponse.success(reply, user);
    },
  );
};
