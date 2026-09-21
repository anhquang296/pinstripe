import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  ApiKeyResponse,
  CreateApiKeyPayload,
  FindApiKeysQuery,
  ListResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const API_KEYS_PATH = '/v1/api_keys';

export class ApiKeysResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindApiKeysQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<ApiKeyResponse>> {
    return this._transport.request({
      path: API_KEYS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  create(payload: CreateApiKeyPayload, options?: RequestOptions): Promise<ApiKeyResponse> {
    return this._transport.request({
      path: API_KEYS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(apiKeyId: string, options?: RequestOptions): Promise<ApiKeyResponse> {
    return this._transport.request({
      path: buildPath(API_KEYS_PATH, apiKeyId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
