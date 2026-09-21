import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import {
  createInvoiceSchema,
  findInvoicesSchema,
  getUpcomingInvoiceSchema,
  invoiceParamsSchema,
  invoiceSchema,
  payInvoiceSchema,
  ratedInvoiceSchema,
  voidInvoiceSchema,
} from '@vxrerp/billing/contracts';
import { ListResponseSchema } from '@vxrerp/platform/contracts';

export const invoicesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/upcoming',
    {
      schema: {
        operationId: 'invoices.getUpcoming',
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
    {
      schema: {
        operationId: 'invoices.create',
        body: createInvoiceSchema,
        response: { 201: invoiceSchema },
      },
    },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.createInvoice(request.body);

      return ApiResponse.created(reply, invoice);
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        operationId: 'invoices.find',
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
    {
      schema: {
        operationId: 'invoices.get',
        params: invoiceParamsSchema,
        response: { 200: invoiceSchema },
      },
    },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.getInvoice(request.params.invoiceId);

      return ApiResponse.success(reply, invoice);
    },
  );

  fastify.post(
    '/:invoiceId/finalize',
    {
      schema: {
        operationId: 'invoices.finalize',
        params: invoiceParamsSchema,
        response: { 200: invoiceSchema },
      },
    },
    async (request, reply) => {
      const invoice = await fastify.invoiceService.finalizeInvoice(request.params.invoiceId);

      return ApiResponse.success(reply, invoice);
    },
  );

  fastify.post(
    '/:invoiceId/pay',
    {
      schema: {
        operationId: 'invoices.pay',
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
        operationId: 'invoices.void',
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
