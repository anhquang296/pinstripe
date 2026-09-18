import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createPromotionCodeSchema,
  findPromotionCodesSchema,
  ListResponseSchema,
  promotionCodeParamsSchema,
  promotionCodeSchema,
  updatePromotionCodeSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const promotionCodesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createPromotionCodeSchema, response: { 201: promotionCodeSchema } } },
    async (request, reply) => {
      const promotionCode = await fastify.promotionCodeService.createPromotionCode(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, promotionCode);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findPromotionCodesSchema,
        response: { 200: ListResponseSchema(promotionCodeSchema) },
      },
    },
    async (request, reply) => {
      const promotionCodes = await fastify.promotionCodeService.findPromotionCodes(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, promotionCodes);
    },
  );

  fastify.get(
    '/:promotionCodeId',
    { schema: { params: promotionCodeParamsSchema, response: { 200: promotionCodeSchema } } },
    async (request, reply) => {
      const promotionCode = await fastify.promotionCodeService.getPromotionCode(
        request.params.promotionCodeId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, promotionCode);
    },
  );

  fastify.post(
    '/:promotionCodeId',
    {
      schema: {
        params: promotionCodeParamsSchema,
        body: updatePromotionCodeSchema,
        response: { 200: promotionCodeSchema },
      },
    },
    async (request, reply) => {
      const promotionCode = await fastify.promotionCodeService.updatePromotionCode(
        request.params.promotionCodeId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, promotionCode);
    },
  );
};
