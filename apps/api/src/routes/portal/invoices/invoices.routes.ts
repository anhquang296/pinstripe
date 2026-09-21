import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { ApiResponse } from '@utils/api-response';
import { readPortalAuth } from '@utils/request-auth';
import {
  findPortalInvoicesSchema,
  findPortalPaymentsSchema,
  invoiceSchema,
  ListResponseSchema,
  portalBankTransferSchema,
  portalInvoiceComparisonSchema,
  portalInvoiceParamsSchema,
  portalInvoiceRemindersSchema,
  portalInvoiceTotalsSchema,
  portalPaymentSchema,
} from '@vxrerp/core/contracts';

export const portalInvoicesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/invoice_exports',
    { schema: { querystring: findPortalInvoicesSchema } },
    async (request, reply) => {
      const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

      const { customerId } = readPortalAuth(request);

      const csv = await fastify.invoiceService.exportCustomerInvoices(customerId, request.query);
      const exportedOn = fastify.clock.now().toISOString().slice(0, 10);

      return reply
        .type(CSV_CONTENT_TYPE)
        .header('content-disposition', `attachment; filename="hoa-don-${exportedOn}.csv"`)
        .send(csv);
    },
  );

  fastify.get(
    '/invoices/:invoiceId/bank_transfer',
    { schema: { params: portalInvoiceParamsSchema, response: { 200: portalBankTransferSchema } } },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);

      const bankTransfer = await fastify.bankTransferService.getCustomerBankTransfer(
        customerId,
        request.params.invoiceId,
      );

      return ApiResponse.success(reply, bankTransfer);
    },
  );

  fastify.get(
    '/payments',
    {
      schema: {
        querystring: findPortalPaymentsSchema,
        response: { 200: ListResponseSchema(portalPaymentSchema) },
      },
    },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);

      const payments = await fastify.invoiceService.findCustomerInvoicePayments(
        customerId,
        request.query,
      );

      return ApiResponse.success(reply, payments);
    },
  );

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
    '/invoices/:invoiceId/comparison',
    {
      schema: {
        params: portalInvoiceParamsSchema,
        response: { 200: portalInvoiceComparisonSchema },
      },
    },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);

      const comparison = await fastify.invoiceService.getCustomerInvoiceComparison(
        customerId,
        request.params.invoiceId,
      );

      return ApiResponse.success(reply, comparison);
    },
  );

  fastify.get(
    '/invoices/:invoiceId/reminders',
    {
      schema: {
        params: portalInvoiceParamsSchema,
        response: { 200: portalInvoiceRemindersSchema },
      },
    },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);

      const reminders = await fastify.invoiceService.findCustomerInvoiceReminders(
        customerId,
        request.params.invoiceId,
      );

      return ApiResponse.success(reply, reminders);
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
