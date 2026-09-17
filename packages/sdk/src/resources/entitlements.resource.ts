import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  EntitlementResponse,
  FindEntitlementsQuery,
  ListResponse,
} from '@type/contracts.types';

const ENTITLEMENTS_PATH = '/v1/entitlements';

export class EntitlementsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
