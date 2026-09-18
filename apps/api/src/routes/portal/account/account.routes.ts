import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  findPortalInvoicesSchema,
  findPortalPaymentMethodsSchema,
  findPortalSubscriptionsSchema,
  invoiceSchema,
  ListResponseSchema,
  paymentMethodSchema,
  portalIdentitySchema,
  portalSessionSchema,
  subscriptionSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readPortalAuth } from '@utils/request-auth';

export const portalAccountRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/me',
    { schema: { response: { 200: portalIdentitySchema } } },
    async (request, reply) => {
      const { customerId, livemode, portalSessionId } = readPortalAuth(request);
      const customer = await fastify.customerService.getCustomer(customerId, livemode);
      const portalSession = await fastify.portalSessionService.getPortalSession(portalSessionId);

      return ApiResponse.success(reply, {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        currency: customer.currency,
        sessionExpiresAt: portalSession.sessionExpiresAt,
      });
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
      const { customerId, livemode } = readPortalAuth(request);
      const invoices = await fastify.invoiceService.findInvoices(
        { ...request.query, customerId },
        livemode,
      );

      return ApiResponse.success(reply, invoices);
    },
  );

  fastify.get(
    '/subscriptions',
    {
      schema: {
        querystring: findPortalSubscriptionsSchema,
        response: { 200: ListResponseSchema(subscriptionSchema) },
      },
    },
    async (request, reply) => {
      const { customerId, livemode } = readPortalAuth(request);
      const subscriptions = await fastify.subscriptionService.findSubscriptions(
        { ...request.query, customerId },
        livemode,
      );

      return ApiResponse.success(reply, subscriptions);
    },
  );

  fastify.get(
    '/payment_methods',
    {
      schema: {
        querystring: findPortalPaymentMethodsSchema,
        response: { 200: ListResponseSchema(paymentMethodSchema) },
      },
    },
    async (request, reply) => {
      const { customerId, livemode } = readPortalAuth(request);
      const paymentMethods = await fastify.paymentMethodService.findPaymentMethods(
        { ...request.query, customerId },
        livemode,
      );

      return ApiResponse.success(reply, paymentMethods);
    },
  );

  fastify.delete(
    '/sessions',
    { schema: { response: { 200: portalSessionSchema } } },
    async (request, reply) => {
      const { portalSessionId } = readPortalAuth(request);
      const portalSession = await fastify.portalSessionService.revokePortalSession(portalSessionId);

      return ApiResponse.success(reply, portalSession);
    },
  );
};
