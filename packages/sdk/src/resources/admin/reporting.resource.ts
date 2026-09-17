import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  GetReconciliationReportQuery,
  GetRevenueSummaryQuery,
  ReconciliationReportResponse,
  RevenueSummaryResponse,
} from '@type/contracts.types';

const REPORTING_PATH = '/api/v1/admin/reporting';

export class ReportingResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  retrieveRevenueSummary(
    query: GetRevenueSummaryQuery = {},
    options?: RequestOptions,
  ): Promise<RevenueSummaryResponse> {
    return this._transport.request({
      path: `${REPORTING_PATH}/revenue`,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieveReconciliationReport(
    query: GetReconciliationReportQuery,
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
