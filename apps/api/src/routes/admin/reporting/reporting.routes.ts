import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  aggregateReconciliationReportSchema,
  aggregateRevenueSummarySchema,
  reconciliationReportSchema,
  revenueSummarySchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';
import { readLivemode } from '@utils/request-auth';

export const reportingRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/revenue',
    {
      schema: {
        querystring: aggregateRevenueSummarySchema,
        response: { 200: revenueSummarySchema },
      },
    },
    async (request, reply) => {
      const summary = await fastify.reportingService.aggregateRevenueSummary(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, summary);
    },
  );

  fastify.get(
    '/reconciliation',
    {
      schema: {
        querystring: aggregateReconciliationReportSchema,
        response: { 200: reconciliationReportSchema },
      },
    },
    async (request, reply) => {
      const report = await fastify.reconciliationService.aggregateReconciliationReport(
        request.query,
        readLivemode(request),
      );

      return ApiResponse.success(reply, report);
    },
  );
};
