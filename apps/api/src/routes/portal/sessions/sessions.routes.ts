import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createPortalLinkSchema,
  portalLinkSchema,
  portalSessionSchema,
  redeemPortalLinkSchema,
} from '@vxrerp/billing/contracts';

export const portalSessionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/links',
    { schema: { body: createPortalLinkSchema, response: { 202: portalLinkSchema } } },
    async (request, reply) => {
      const link = await fastify.portalSessionService.createPortalLink(request.body);

      return ApiResponse.accepted(reply, {
        linkExpiresAt: link.linkExpiresAt.toISOString(),
      });
    },
  );

  fastify.post(
    '/sessions',
    { schema: { body: redeemPortalLinkSchema, response: { 201: portalSessionSchema } } },
    async (request, reply) => {
      const portalSession = await fastify.portalSessionService.redeemPortalLink(request.body);

      return ApiResponse.created(reply, portalSession);
    },
  );
};
