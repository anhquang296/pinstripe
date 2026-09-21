import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createPromotionCodeSchema,
  findPromotionCodesSchema,
  ListResponseSchema,
  promotionCodeParamsSchema,
  promotionCodeSchema,
  updatePromotionCodeSchema,
} from '@vxrerp/core/contracts';

export const promotionCodesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'promotionCodes.create',
        body: createPromotionCodeSchema,
        response: { 201: promotionCodeSchema },
      },
    },
    async (request, reply) => {
      const promotionCode = await fastify.promotionCodeService.createPromotionCode(request.body);

      return ApiResponse.created(reply, promotionCode);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'promotionCodes.find',
        querystring: findPromotionCodesSchema,
        response: { 200: ListResponseSchema(promotionCodeSchema) },
      },
    },
    async (request, reply) => {
      const promotionCodes = await fastify.promotionCodeService.findPromotionCodes(request.query);

      return ApiResponse.success(reply, promotionCodes);
    },
  );

  fastify.get(
    '/:promotionCodeId',
    {
      schema: {
        operationId: 'promotionCodes.get',
        params: promotionCodeParamsSchema,
        response: { 200: promotionCodeSchema },
      },
    },
    async (request, reply) => {
      const promotionCode = await fastify.promotionCodeService.getPromotionCode(
        request.params.promotionCodeId,
      );

      return ApiResponse.success(reply, promotionCode);
    },
  );

  fastify.post(
    '/:promotionCodeId',
    {
      schema: {
        operationId: 'promotionCodes.update',
        params: promotionCodeParamsSchema,
        body: updatePromotionCodeSchema,
        response: { 200: promotionCodeSchema },
      },
    },
    async (request, reply) => {
      const promotionCode = await fastify.promotionCodeService.updatePromotionCode(
        request.params.promotionCodeId,
        request.body,
      );

      return ApiResponse.success(reply, promotionCode);
    },
  );
};
