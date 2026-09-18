import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createInvoiceSchema,
  findInvoicesSchema,
  getUpcomingInvoiceSchema,
  invoiceParamsSchema,
  invoiceSchema,
  ListResponseSchema,
  payInvoiceSchema,
  ratedInvoiceSchema,
  voidInvoiceSchema,
} from '@pinstripe/core/contracts';
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

  fastify.post(
    '/',
    { schema: { body: createInvoiceSchema, response: { 201: invoiceSchema } } },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.createInvoice(request.body);

      return ApiResponse.created(reply, invoice);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        querystring: findInvoicesSchema,
        response: { 200: ListResponseSchema(invoiceSchema) },
      },
    },
    async (request, reply) => {
      const invoices = await fastify.invoiceService.findInvoices(request.query);

      return ApiResponse.success(reply, invoices);
    },
  );

  fastify.get(
    '/:invoiceId',
    { schema: { params: invoiceParamsSchema, response: { 200: invoiceSchema } } },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.getInvoice(request.params.invoiceId);

      return ApiResponse.success(reply, invoice);
    },
  );

  fastify.post(
    '/:invoiceId/finalize',
    { schema: { params: invoiceParamsSchema, response: { 200: invoiceSchema } } },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.finalizeInvoice(request.params.invoiceId);

      return ApiResponse.success(reply, invoice);
    },
  );

  fastify.post(
    '/:invoiceId/pay',
    {
      schema: {
        params: invoiceParamsSchema,
        body: payInvoiceSchema,
        response: { 200: invoiceSchema },
      },
    },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.payInvoice(
        request.params.invoiceId,
        request.body,
      );

      return ApiResponse.success(reply, invoice);
    },
  );

  fastify.post(
    '/:invoiceId/void',
    {
      schema: {
        params: invoiceParamsSchema,
        body: voidInvoiceSchema,
        response: { 200: invoiceSchema },
      },
    },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.voidInvoice(
        request.params.invoiceId,
        request.body,
      );

      return ApiResponse.success(reply, invoice);
    },
  );
};
