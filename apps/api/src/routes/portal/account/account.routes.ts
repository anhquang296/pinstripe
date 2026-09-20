import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  createPortalRequestSchema,
  CUSTOMER_ACCOUNTANT_EMAIL_KEY,
  CUSTOMER_ACCOUNTANT_NAME_KEY,
  findPortalPaymentMethodsSchema,
  findPortalSubscriptionsSchema,
  ListResponseSchema,
  paymentMethodSchema,
  portalIdentitySchema,
  portalRequestSchema,
  portalSessionSchema,
  portalSubscriptionSchema,
  portalUsageSchema,
  switchPortalCustomerSchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readPortalAuth } from '@utils/request-auth';

export const portalAccountRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/me',
    { schema: { response: { 200: portalIdentitySchema } } },
    async (request, reply) => {
      const { customerId, portalSessionId, portalUserId, role } = readPortalAuth(request);
      const customer = await fastify.customerService.getCustomer(customerId);
      const portalSession = await fastify.portalSessionService.getPortalSession(portalSessionId);
      const { userEmail, memberships } =
        await fastify.portalUserService.findPortalUserAccess(portalUserId);
      const {
        [CUSTOMER_ACCOUNTANT_NAME_KEY]: accountantName = null,
        [CUSTOMER_ACCOUNTANT_EMAIL_KEY]: accountantEmail = null,
      } = customer.metadata;

      return ApiResponse.success(reply, {
        userEmail,
        role,
        memberships,
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

  fastify.post(
    '/sessions/current',
    { schema: { body: switchPortalCustomerSchema, response: { 200: portalSessionSchema } } },
    async (request, reply) => {
      const portalSession = await fastify.portalSessionService.switchPortalSessionCustomer(
        readPortalAuth(request),
        request.body.customerId,
      );

      return ApiResponse.success(reply, portalSession);
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
    '/usage',
    { schema: { response: { 200: portalUsageSchema } } },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);

      const usage = await fastify.portalUsageService.findCustomerUsage(customerId);

      return ApiResponse.success(reply, usage);
    },
  );

  fastify.post(
    '/requests',
    { schema: { body: createPortalRequestSchema, response: { 201: portalRequestSchema } } },
    async (request, reply) => {
      const { customerId } = readPortalAuth(request);

      const portalRequest = await fastify.portalRequestService.createPortalRequest(
        customerId,
        request.body,
      );

      return ApiResponse.created(reply, portalRequest);
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
