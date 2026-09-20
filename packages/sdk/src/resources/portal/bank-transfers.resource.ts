import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { PortalBankTransferResponse } from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PORTAL_INVOICES_PATH = '/v1/portal/invoices';

export class PortalBankTransfersResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
