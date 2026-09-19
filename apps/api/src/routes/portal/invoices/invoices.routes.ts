import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  findPortalInvoicesSchema,
  invoiceSchema,
  ListResponseSchema,
  portalInvoiceParamsSchema,
  portalInvoiceTotalsSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readPortalAuth } from '@utils/request-auth';

export const portalInvoicesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/invoices',
    {
      schema: {
        querystring: findPortalInvoicesSchema,
        response: { 200: ListResponseSchema(invoiceSchema) },
      },
    },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);
      const invoices = await fastify.invoiceService.findCustomerInvoices(customerId, request.query);

      return ApiResponse.success(reply, invoices);
    },
  );

  fastify.get(
    '/invoices/:invoiceId',
    { schema: { params: portalInvoiceParamsSchema, response: { 200: invoiceSchema } } },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);
      const invoice = await fastify.invoiceService.getCustomerInvoice(
        customerId,
        request.params.invoiceId,
      );

      return ApiResponse.success(reply, invoice);
    },
  );

  fastify.get(
    '/invoices/:invoiceId/pdf',
    { schema: { params: portalInvoiceParamsSchema } },
    async (request, reply) => {
      const PDF_CONTENT_TYPE = 'application/pdf';

      const { customerId } = readPortalAuth(request);
      const { invoiceId } = request.params;
      const document = await fastify.invoiceDocumentService.getCustomerInvoicePdf(
        customerId,
        invoiceId,
      );

      return reply
        .type(PDF_CONTENT_TYPE)
        .header('content-disposition', `attachment; filename="${invoiceId}.pdf"`)
        .send(document);
    },
  );

  fastify.get(
    '/invoice_totals',
    { schema: { response: { 200: portalInvoiceTotalsSchema } } },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);
      const invoiceTotals = await fastify.invoiceService.aggregateCustomerInvoiceTotals(customerId);

      return ApiResponse.success(reply, invoiceTotals);
    },
  );
};
