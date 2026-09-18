import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createTaxIdSchema,
  deletedTaxIdSchema,
  findTaxIdsSchema,
  ListResponseSchema,
  taxIdParamsSchema,
  taxIdSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const taxIdsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'taxIds.create',
        body: createTaxIdSchema,
        response: { 201: taxIdSchema },
      },
    },
    async (request, reply) => {
      const taxId = await fastify.taxIdService.createTaxId(request.body);

      return ApiResponse.created(reply, taxId);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'taxIds.find',
        querystring: findTaxIdsSchema,
        response: { 200: ListResponseSchema(taxIdSchema) },
      },
    },
    async (request, reply) => {
      const taxIds = await fastify.taxIdService.findTaxIds(request.query);

      return ApiResponse.success(reply, taxIds);
    },
  );

  fastify.get(
    '/:taxIdId',
    {
      schema: {
        operationId: 'taxIds.get',
        params: taxIdParamsSchema,
        response: { 200: taxIdSchema },
      },
    },
    async (request, reply) => {
      const taxId = await fastify.taxIdService.getTaxId(request.params.taxIdId);

      return ApiResponse.success(reply, taxId);
    },
  );

  fastify.delete(
    '/:taxIdId',
    {
      schema: {
        operationId: 'taxIds.delete',
        params: taxIdParamsSchema,
        response: { 200: deletedTaxIdSchema },
      },
    },
    async (request, reply) => {
      const deletedTaxId = await fastify.taxIdService.deleteTaxId(request.params.taxIdId);

      return ApiResponse.success(reply, deletedTaxId);
    },
  );
};
