import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { FindPortalInvoicesQuery, InvoiceResponse, ListResponse } from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PORTAL_INVOICES_PATH = '/v1/portal/invoices';

export class PortalInvoicesResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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

  get(invoiceId: string, options?: RequestOptions): Promise<InvoiceResponse> {
    return this._transport.request({
      path: buildPath(PORTAL_INVOICES_PATH, invoiceId),
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
