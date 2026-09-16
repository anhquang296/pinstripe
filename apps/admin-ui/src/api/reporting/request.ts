import { Endpoint, Method, Params, Request } from '@api/client';

import type {
  GetReconciliationReportQuery,
  GetRevenueSummaryQuery,
  ReconciliationReportResponse,
  RevenueSummaryResponse,
} from './type';

const REPORTING_PATH = '/api/v1/admin/reporting';

export function getRevenueSummary(
  query: GetRevenueSummaryQuery = {},
): Promise<RevenueSummaryResponse> {
  return Request<RevenueSummaryResponse>(
    Endpoint(`${REPORTING_PATH}/revenue`),
    Method('GET'),
    Params(query),
  );
}

export function getReconciliationReport(
  query: GetReconciliationReportQuery,
): Promise<ReconciliationReportResponse> {
  return Request<ReconciliationReportResponse>(
    Endpoint(`${REPORTING_PATH}/reconciliation`),
    Method('GET'),
    Params(query),
  );
}
