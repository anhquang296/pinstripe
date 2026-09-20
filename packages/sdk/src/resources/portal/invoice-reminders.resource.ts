import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { PortalInvoiceRemindersResponse } from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PORTAL_INVOICES_PATH = '/v1/portal/invoices';

export class PortalInvoiceRemindersResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(invoiceId: string, options?: RequestOptions): Promise<PortalInvoiceRemindersResponse> {
    return this._transport.request({
      path: buildPath(PORTAL_INVOICES_PATH, invoiceId, 'reminders'),
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
