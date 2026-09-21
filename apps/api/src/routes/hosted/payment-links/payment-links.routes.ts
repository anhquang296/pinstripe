import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { paymentLinkParamsSchema } from '@vxrerp/billing/contracts';

const hostedPaymentLinkQuerySchema = Type.Object({
  token: Type.String({ minLength: 1 }),
  customerId: Type.String({ minLength: 1 }),
});

const REDIRECT_STATUS_CODE = 303;

export const hostedPaymentLinksRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/:paymentLinkId',
    { schema: { params: paymentLinkParamsSchema, querystring: hostedPaymentLinkQuerySchema } },
    async (request, reply) => {
      const { paymentLinkId } = request.params;

      const { token, customerId } = request.query;

      const paymentLink = await fastify.paymentLinkService.getHostedPaymentLink(
        paymentLinkId,
        token,
      );

      const checkoutSession = await fastify.checkoutService.createPaymentLinkCheckoutSession(
        paymentLink.id,
        customerId,
      );

      const { url } = checkoutSession;

      if (url) {
        return reply.redirect(url, REDIRECT_STATUS_CODE);
      }

      return reply.redirect(paymentLink.successUrl, REDIRECT_STATUS_CODE);
    },
  );
};
