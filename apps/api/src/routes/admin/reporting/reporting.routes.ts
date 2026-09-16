import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  getReconciliationReportSchema,
  getRevenueSummarySchema,
  reconciliationReportSchema,
  revenueSummarySchema,
} from '@pinstripe/core/contracts';
import { ApiResponse } from '@utils/api-response';

export const reportingRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/revenue',
    { schema: { querystring: getRevenueSummarySchema, response: { 200: revenueSummarySchema } } },
    async (request, reply) => {
      const summary = await fastify.reportingService.getRevenueSummary(request.query);

      return ApiResponse.success(reply, summary);
    },
  );

  fastify.get(
    '/reconciliation',
    {
      schema: {
        querystring: getReconciliationReportSchema,
        response: { 200: reconciliationReportSchema },
      },
    },
    async (request, reply) => {
      const report = await fastify.reconciliationService.getReconciliationReport(request.query);

      return ApiResponse.success(reply, report);
    },
  );
};
