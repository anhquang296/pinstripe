import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createPortalLinkSchema,
  portalLinkSchema,
  portalSessionSchema,
  redeemPortalLinkSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const portalSessionsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPortalLinkSchema, response: { 202: portalLinkSchema } } },
    async (request, reply) => {
      const livemode = readLivemode(request);
      const link = await fastify.portalSessionService.createPortalLink(request.body, livemode);

      return ApiResponse.accepted(reply, {
        object: 'portal_link' as const,
        livemode,
        linkExpiresAt: link.linkExpiresAt.toISOString(),
      });
    },
  );

  fastify.post(
    '/redeem',
    { schema: { body: redeemPortalLinkSchema, response: { 201: portalSessionSchema } } },
    async (request, reply) => {
      const portalSession = await fastify.portalSessionService.redeemPortalLink(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, portalSession);
    },
  );
};
