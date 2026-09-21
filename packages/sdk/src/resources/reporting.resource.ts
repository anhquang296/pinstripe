import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  AggregateReconciliationReportQuery,
  AggregateRevenueSummaryQuery,
  ReconciliationReportResponse,
  RevenueSummaryResponse,
} from '@type/contracts.types';

const REPORTING_PATH = '/v1/reporting';

export class ReportingResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  getRevenueSummary(
    query: AggregateRevenueSummaryQuery = {},
    options?: RequestOptions,
  ): Promise<RevenueSummaryResponse> {
    return this._transport.request({
      path: `${REPORTING_PATH}/revenue`,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  getReconciliationReport(
    query: AggregateReconciliationReportQuery,
    options?: RequestOptions,
  ): Promise<ReconciliationReportResponse> {
    return this._transport.request({
      path: `${REPORTING_PATH}/reconciliation`,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
