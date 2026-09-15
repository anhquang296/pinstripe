import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { getUpcomingInvoiceSchema, ratedInvoiceSchema } from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const invoicesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/upcoming',
    {
      schema: {
        querystring: getUpcomingInvoiceSchema,
        response: { 200: ratedInvoiceSchema },
      },
    },
    async (request, reply) => {
      const ratedInvoice = await fastify.ratingService.rateUpcomingInvoice(
        request.query.subscriptionId,
      );

      return ApiResponse.success(reply, ratedInvoice);
    },
  );
};
