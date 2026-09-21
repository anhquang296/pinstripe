import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { PortalInvoiceTotalsResponse } from '@type/contracts.types';

const PORTAL_INVOICE_TOTALS_PATH = '/v1/portal/invoice_totals';

export class PortalInvoiceTotalsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  get(options?: RequestOptions): Promise<PortalInvoiceTotalsResponse> {
    return this._transport.request({
      path: PORTAL_INVOICE_TOTALS_PATH,
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
