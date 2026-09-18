import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { buildInvoicePage } from '@utils/hosted-page';

const hostedInvoiceParamsSchema = Type.Object({ invoiceId: Type.String() });
const hostedTokenSchema = Type.Object({ token: Type.String({ minLength: 1 }) });

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const PDF_CONTENT_TYPE = 'application/pdf';

export const hostedInvoicesRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/:invoiceId',
    { schema: { params: hostedInvoiceParamsSchema, querystring: hostedTokenSchema } },
    async (request, reply) => {
      const { invoiceId } = request.params;
      const entity = await fastify.invoiceDocumentService.getVerifiedInvoice(
        invoiceId,
        request.query.token,
      );
      const invoice = await fastify.invoiceService.getInvoice(entity.id);
      const pdfUrl = fastify.hostedUrlFactory.buildInvoicePdfUrl(entity.id);

      return reply.type(HTML_CONTENT_TYPE).send(buildInvoicePage(invoice, pdfUrl));
    },
  );

  fastify.get(
    '/:invoiceId/pdf',
    { schema: { params: hostedInvoiceParamsSchema, querystring: hostedTokenSchema } },
    async (request, reply) => {
      const document = await fastify.invoiceDocumentService.getInvoicePdf(
        request.params.invoiceId,
        request.query.token,
      );

      return reply.type(PDF_CONTENT_TYPE).send(document);
    },
  );
};
