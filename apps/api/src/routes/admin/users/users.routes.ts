import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createUserSchema,
  findUsersSchema,
  ListResponseSchema,
  PermissionEnum,
  updateUserSchema,
  userParamsSchema,
  userSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { buildRouteConfig } from '@utils/route-permission';

export const usersRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      config: buildRouteConfig(PermissionEnum.USER_MANAGE),
      schema: {
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
      config: buildRouteConfig(PermissionEnum.USER_MANAGE),
      schema: { params: userParamsSchema, response: { 200: userSchema } },
    },
    async (request, reply) => {
      const user = await fastify.userService.getUser(request.params.userId);

      return ApiResponse.success(reply, user);
    },
  );

  fastify.post(
    '/',
    {
      config: buildRouteConfig(PermissionEnum.USER_MANAGE),
      schema: { body: createUserSchema, response: { 201: userSchema } },
    },
    async (request, reply) => {
      const user = await fastify.userService.createUser(request.body);

      return ApiResponse.created(reply, user);
    },
  );

  fastify.patch(
    '/:userId',
    {
      config: buildRouteConfig(PermissionEnum.USER_MANAGE),
      schema: { params: userParamsSchema, body: updateUserSchema, response: { 200: userSchema } },
    },
    async (request, reply) => {
      const user = await fastify.userService.updateUser(request.params.userId, request.body);

      return ApiResponse.success(reply, user);
    },
  );
};
