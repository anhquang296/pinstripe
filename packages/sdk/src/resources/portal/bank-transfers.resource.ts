import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { PortalBankTransferResponse } from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PORTAL_INVOICES_PATH = '/v1/portal/invoices';

export class PortalBankTransfersResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  get(invoiceId: string, options?: RequestOptions): Promise<PortalBankTransferResponse> {
    return this._transport.request({
      path: buildPath(PORTAL_INVOICES_PATH, invoiceId, 'bank_transfer'),
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
