import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createPortalMembershipSchema,
  deletedPortalMembershipSchema,
  findPortalMembershipsSchema,
  portalMembershipParamsSchema,
  portalMembershipSchema,
  updatePortalMembershipSchema,
} from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

export const portalMembershipsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'portalMemberships.create',
        body: createPortalMembershipSchema,
        response: { 201: portalMembershipSchema },
      },
    },
    async (request, reply) => {
      const portalMembership = await fastify.portalUserService.createPortalMembership(request.body);

      return ApiResponse.created(reply, portalMembership);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'portalMemberships.find',
        querystring: findPortalMembershipsSchema,
        response: { 200: ListResponseSchema(portalMembershipSchema) },
      },
    },
    async (request, reply) => {
      const portalMemberships = await fastify.portalUserService.findPortalMemberships(
        request.query,
      );

      return ApiResponse.success(reply, portalMemberships);
    },
  );

  fastify.post(
    '/:portalMembershipId',
    {
      schema: {
        operationId: 'portalMemberships.update',
        params: portalMembershipParamsSchema,
        body: updatePortalMembershipSchema,
        response: { 200: portalMembershipSchema },
      },
    },
    async (request, reply) => {
      const portalMembership = await fastify.portalUserService.updatePortalMembership(
        request.params.portalMembershipId,
        request.body,
      );

      return ApiResponse.success(reply, portalMembership);
    },
  );

  fastify.delete(
    '/:portalMembershipId',
    {
      schema: {
        operationId: 'portalMemberships.delete',
        params: portalMembershipParamsSchema,
        response: { 200: deletedPortalMembershipSchema },
      },
    },
    async (request, reply) => {
      const deletedPortalMembership = await fastify.portalUserService.deletePortalMembership(
        request.params.portalMembershipId,
      );

      return ApiResponse.success(reply, deletedPortalMembership);
    },
  );
};
