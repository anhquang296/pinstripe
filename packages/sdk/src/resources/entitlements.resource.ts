import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  EntitlementResponse,
  FindEntitlementsQuery,
  ListResponse,
} from '@type/contracts.types';

const ENTITLEMENTS_PATH = '/v1/entitlements';

export class EntitlementsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindEntitlementsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<EntitlementResponse>> {
    return this._transport.request({
      path: ENTITLEMENTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
