import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  FindPortalPaymentMethodsQuery,
  ListResponse,
  PaymentMethodResponse,
} from '@type/contracts.types';

const PORTAL_PAYMENT_METHODS_PATH = '/v1/portal/payment_methods';

export class PortalPaymentMethodsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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
