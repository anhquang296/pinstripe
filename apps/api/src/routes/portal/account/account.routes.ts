import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  CUSTOMER_ACCOUNTANT_EMAIL_KEY,
  CUSTOMER_ACCOUNTANT_NAME_KEY,
  findPortalPaymentMethodsSchema,
  findPortalSubscriptionsSchema,
  ListResponseSchema,
  paymentMethodSchema,
  portalIdentitySchema,
  portalSessionSchema,
  portalSubscriptionSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readPortalAuth } from '@utils/request-auth';

export const portalAccountRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/me',
    { schema: { response: { 200: portalIdentitySchema } } },
    async (request, reply) => {
      const { customerId, portalSessionId } = readPortalAuth(request);
      const customer = await fastify.customerService.getCustomer(customerId);
      const portalSession = await fastify.portalSessionService.getPortalSession(portalSessionId);
      const {
        [CUSTOMER_ACCOUNTANT_NAME_KEY]: accountantName = null,
        [CUSTOMER_ACCOUNTANT_EMAIL_KEY]: accountantEmail = null,
      } = customer.metadata;

      return ApiResponse.success(reply, {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        taxId: customer.taxId,
        address: customer.address,
        currency: customer.currency,
        balance: customer.balance,
        accountantName,
        accountantEmail,
        sessionExpiresAt: portalSession.sessionExpiresAt,
      });
    },
  );

  fastify.get(
    '/subscriptions',
    {
      schema: {
        querystring: findPortalSubscriptionsSchema,
        response: { 200: ListResponseSchema(portalSubscriptionSchema) },
      },
    },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);
      const subscriptions = await fastify.subscriptionService.findCustomerSubscriptions(
        customerId,
        request.query,
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
      const { customerId } = readPortalAuth(request);
      const paymentMethods = await fastify.paymentMethodService.findPaymentMethods({
        ...request.query,
        customerId,
      });

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
