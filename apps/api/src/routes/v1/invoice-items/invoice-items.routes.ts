import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createInvoiceItemSchema,
  deletedInvoiceItemSchema,
  findInvoiceItemsSchema,
  invoiceItemParamsSchema,
  invoiceItemSchema,
  ListResponseSchema,
  updateInvoiceItemSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const invoiceItemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    { schema: { body: createInvoiceItemSchema, response: { 201: invoiceItemSchema } } },
    async (request, reply) => {
      const invoiceItem = await fastify.invoiceItemService.createInvoiceItem(
        request.body,
        readLivemode(request),
      );

      return ApiResponse.created(reply, invoiceItem);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findInvoiceItemsSchema,
        response: { 200: ListResponseSchema(invoiceItemSchema) },
      },
    },
    async (request, reply) => {
      const invoiceItems = await fastify.invoiceItemService.findInvoiceItems(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, invoiceItems);
    },
  );

  fastify.get(
    '/:invoiceItemId',
    { schema: { params: invoiceItemParamsSchema, response: { 200: invoiceItemSchema } } },
    async (request, reply) => {
      const invoiceItem = await fastify.invoiceItemService.getInvoiceItem(
        request.params.invoiceItemId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, invoiceItem);
    },
  );

  fastify.post(
    '/:invoiceItemId',
    {
      schema: {
        params: invoiceItemParamsSchema,
        body: updateInvoiceItemSchema,
        response: { 200: invoiceItemSchema },
      },
    },
    async (request, reply) => {
      const invoiceItem = await fastify.invoiceItemService.updateInvoiceItem(
        request.params.invoiceItemId,
        request.body,
        readLivemode(request),
      );

      return ApiResponse.success(reply, invoiceItem);
    },
  );

  fastify.delete(
    '/:invoiceItemId',
    { schema: { params: invoiceItemParamsSchema, response: { 200: deletedInvoiceItemSchema } } },
    async (request, reply) => {
      const deletedInvoiceItem = await fastify.invoiceItemService.deleteInvoiceItem(
        request.params.invoiceItemId,
        readLivemode(request),
      );

      return ApiResponse.success(reply, deletedInvoiceItem);
    },
  );
};
