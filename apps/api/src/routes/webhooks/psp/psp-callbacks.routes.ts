import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { verifyPspCallbackRequest } from '@hooks/verify-psp-callback-request';
import { ApiResponse } from '@utils/api-response';
import {
  pspCallbackParamsSchema,
  pspCallbackResponseSchema,
  pspCallbackSchema,
} from '@vxrerp/billing/contracts';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export const pspCallbacksRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBody = body as string;

    request.rawBody = rawBody;

    try {
      done(null, JSON.parse(rawBody));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  fastify.addHook('preHandler', verifyPspCallbackRequest);

  fastify.post(
    '/:provider/callbacks',
    {
      schema: {
        params: pspCallbackParamsSchema,
        body: pspCallbackSchema,
        response: { 200: pspCallbackResponseSchema },
      },
    },
    async (request, reply) => {
      const receipt = await fastify.paymentService.handleProviderEvent(
        request.params.provider,
        request.body,
      );

      return ApiResponse.success(reply, receipt);
    },
  );
};
