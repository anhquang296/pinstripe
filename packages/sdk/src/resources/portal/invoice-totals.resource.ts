import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { PortalInvoiceTotalsResponse } from '@type/contracts.types';

const PORTAL_INVOICE_TOTALS_PATH = '/portal/invoice_totals';

export class PortalInvoiceTotalsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
