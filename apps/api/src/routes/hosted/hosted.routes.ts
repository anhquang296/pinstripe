import { verifyHostedRequest } from '@hooks/verify-hosted-request';
import { hostedCheckoutRoutes } from '@routes/hosted/checkout/checkout.routes';
import { hostedInvoicesRoutes } from '@routes/hosted/invoices/invoices.routes';
import { hostedPaymentLinksRoutes } from '@routes/hosted/payment-links/payment-links.routes';
import type { FastifyInstance } from 'fastify';

const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';

export async function hostedRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', verifyHostedRequest);

  fastify.addContentTypeParser(FORM_CONTENT_TYPE, { parseAs: 'string' }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  await fastify.register(hostedCheckoutRoutes, { prefix: '/checkout' });
  await fastify.register(hostedInvoicesRoutes, { prefix: '/invoice' });
  await fastify.register(hostedPaymentLinksRoutes, { prefix: '/pay' });
}
