import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createProductSchema,
  findProductsSchema,
  ListResponseSchema,
  productParamsSchema,
  productSchema,
  updateProductSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const productsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createProductSchema, response: { 201: productSchema } } },
    async (request, reply) => {
      const product = await fastify.productService.createProduct(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, product);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findProductsSchema,
        response: { 200: ListResponseSchema(productSchema) },
      },
    },
    async (request, reply) => {
      const products = await fastify.productService.findProducts(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, products);
    },
  );

  fastify.get(
    '/:productId',
    { schema: { params: productParamsSchema, response: { 200: productSchema } } },
    async (request, reply) => {
      const product = await fastify.productService.getProduct(request.params.productId);

      return ApiResponse.success(reply, product);
    },
  );

  fastify.post(
    '/:productId',
    {
      schema: {
        params: productParamsSchema,
        body: updateProductSchema,
        response: { 200: productSchema },
      },
    },
    async (request, reply) => {
      const product = await fastify.productService.updateProduct(
        request.params.productId,
        request.body,
      );

      return ApiResponse.success(reply, product);
    },
  );
};
