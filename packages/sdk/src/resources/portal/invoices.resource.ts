import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { FindPortalInvoicesQuery, InvoiceResponse, ListResponse } from '@type/contracts.types';

const PORTAL_INVOICES_PATH = '/portal/invoices';

export class PortalInvoicesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindPortalInvoicesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<InvoiceResponse>> {
    return this._transport.request({
      path: PORTAL_INVOICES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
