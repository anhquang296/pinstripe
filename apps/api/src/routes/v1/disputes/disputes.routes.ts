import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  disputeParamsSchema,
  disputeSchema,
  findDisputesSchema,
  ListResponseSchema,
  submitDisputeEvidenceSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const disputesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        querystring: findDisputesSchema,
        response: { 200: ListResponseSchema(disputeSchema) },
      },
    },
    async (request, reply) => {
      const disputes = await fastify.disputeService.findDisputes(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, disputes);
    },
  );

  fastify.get(
    '/:disputeId',
    { schema: { params: disputeParamsSchema, response: { 200: disputeSchema } } },
    async (request, reply) => {
      const dispute = await fastify.disputeService.getDispute(
        request.params.disputeId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, dispute);
    },
  );

  fastify.post(
    '/:disputeId/evidence',
    {
      schema: {
        params: disputeParamsSchema,
        body: submitDisputeEvidenceSchema,
        response: { 200: disputeSchema },
      },
    },
    async (request, reply) => {
      const dispute = await fastify.disputeService.submitDisputeEvidence(
        request.params.disputeId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, dispute);
    },
  );
};
