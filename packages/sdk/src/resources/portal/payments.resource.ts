import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  FindPortalPaymentsQuery,
  ListResponse,
  PortalPaymentResponse,
} from '@type/contracts.types';

const PORTAL_PAYMENTS_PATH = '/v1/portal/payments';

export class PortalPaymentsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindPortalPaymentsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PortalPaymentResponse>> {
    return this._transport.request({
      path: PORTAL_PAYMENTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
