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

export const invoiceItemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        operationId: 'invoiceItems.create',
        body: createInvoiceItemSchema,
        response: { 201: invoiceItemSchema },
      },
    },
    async (request, reply) => {
      const invoiceItem = await fastify.invoiceItemService.createInvoiceItem(request.body);

      return ApiResponse.created(reply, invoiceItem);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'invoiceItems.find',
        querystring: findInvoiceItemsSchema,
        response: { 200: ListResponseSchema(invoiceItemSchema) },
      },
    },
    async (request, reply) => {
      const invoiceItems = await fastify.invoiceItemService.findInvoiceItems(request.query);

      return ApiResponse.success(reply, invoiceItems);
    },
  );

  fastify.get(
    '/:invoiceItemId',
    {
      schema: {
        operationId: 'invoiceItems.get',
        params: invoiceItemParamsSchema,
        response: { 200: invoiceItemSchema },
      },
    },
    async (request, reply) => {
      const invoiceItem = await fastify.invoiceItemService.getInvoiceItem(
        request.params.invoiceItemId,
      );

      return ApiResponse.success(reply, invoiceItem);
    },
  );

  fastify.post(
    '/:invoiceItemId',
    {
      schema: {
        operationId: 'invoiceItems.update',
        params: invoiceItemParamsSchema,
        body: updateInvoiceItemSchema,
        response: { 200: invoiceItemSchema },
      },
    },
    async (request, reply) => {
      const invoiceItem = await fastify.invoiceItemService.updateInvoiceItem(
        request.params.invoiceItemId,
        request.body,
      );

      return ApiResponse.success(reply, invoiceItem);
    },
  );

  fastify.delete(
    '/:invoiceItemId',
    {
      schema: {
        operationId: 'invoiceItems.delete',
        params: invoiceItemParamsSchema,
        response: { 200: deletedInvoiceItemSchema },
      },
    },
    async (request, reply) => {
      const deletedInvoiceItem = await fastify.invoiceItemService.deleteInvoiceItem(
        request.params.invoiceItemId,
      );

      return ApiResponse.success(reply, deletedInvoiceItem);
    },
  );
};
