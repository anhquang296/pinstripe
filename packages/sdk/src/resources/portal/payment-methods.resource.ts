import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  FindPortalPaymentMethodsQuery,
  ListResponse,
  PaymentMethodResponse,
} from '@type/contracts.types';

const PORTAL_PAYMENT_METHODS_PATH = '/v1/portal/payment_methods';

export class PortalPaymentMethodsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindPortalPaymentMethodsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PaymentMethodResponse>> {
    return this._transport.request({
      path: PORTAL_PAYMENT_METHODS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
