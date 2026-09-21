import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateTaxIdPayload,
  DeletedTaxIdResponse,
  FindTaxIdsQuery,
  ListResponse,
  TaxIdResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const TAX_IDS_PATH = '/v1/tax_ids';

export class TaxIdsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindTaxIdsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<TaxIdResponse>> {
    return this._transport.request({
      path: TAX_IDS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(taxIdId: string, options?: RequestOptions): Promise<TaxIdResponse> {
    return this._transport.request({
      path: buildPath(TAX_IDS_PATH, taxIdId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateTaxIdPayload, options?: RequestOptions): Promise<TaxIdResponse> {
    return this._transport.request({
      path: TAX_IDS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(taxIdId: string, options?: RequestOptions): Promise<DeletedTaxIdResponse> {
    return this._transport.request({
      path: buildPath(TAX_IDS_PATH, taxIdId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
