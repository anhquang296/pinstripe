import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  AggregateReconciliationReportQuery,
  AggregateRevenueSummaryQuery,
  ReconciliationReportResponse,
  RevenueSummaryResponse,
} from '@type/contracts.types';

const REPORTING_PATH = '/v1/reporting';

export class ReportingResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
