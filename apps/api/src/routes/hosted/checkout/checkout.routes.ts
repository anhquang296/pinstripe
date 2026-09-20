import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  checkoutSessionParamsSchema,
  completeCheckoutSessionSchema,
} from '@pinstripe/core/contracts';
import { Type } from '@sinclair/typebox';
import { buildCheckoutPage } from '@utils/hosted-page';

const hostedTokenSchema = Type.Object({ token: Type.String({ minLength: 1 }) });

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const REDIRECT_STATUS_CODE = 303;

export const hostedCheckoutRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/:checkoutSessionId',
    { schema: { params: checkoutSessionParamsSchema, querystring: hostedTokenSchema } },
    async (request, reply) => {
      const { checkoutSessionId } = request.params;

      const { token } = request.query;

      const checkoutSession = await fastify.checkoutService.getHostedCheckoutSession(
        checkoutSessionId,
        token,
      );

      const completeUrl = fastify.hostedUrlFactory.buildCheckoutCompleteUrl(checkoutSessionId);

      return reply.type(HTML_CONTENT_TYPE).send(buildCheckoutPage(checkoutSession, completeUrl));
    },
  );

  fastify.post(
    '/:checkoutSessionId/complete',
    {
      schema: {
        params: checkoutSessionParamsSchema,
        querystring: hostedTokenSchema,
        body: completeCheckoutSessionSchema,
      },
    },
    async (request, reply) => {
      const checkoutSession = await fastify.checkoutService.completeCheckoutSession(
        request.params.checkoutSessionId,
        request.body,
        request.query.token,
      );

      return reply.redirect(checkoutSession.successUrl, REDIRECT_STATUS_CODE);
    },
  );
};
