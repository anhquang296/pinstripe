import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  FindPortalPaymentsQuery,
  ListResponse,
  PortalPaymentResponse,
} from '@type/contracts.types';

const PORTAL_PAYMENTS_PATH = '/v1/portal/payments';

export class PortalPaymentsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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
