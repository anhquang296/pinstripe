import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  BillingPortalConfigurationResponse,
  CreateBillingPortalConfigurationPayload,
  FindBillingPortalConfigurationsQuery,
  ListResponse,
  UpdateBillingPortalConfigurationPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const BILLING_PORTAL_CONFIGURATIONS_PATH = '/v1/billing_portal/configurations';

export class BillingPortalConfigurationsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindBillingPortalConfigurationsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<BillingPortalConfigurationResponse>> {
    return this._transport.request({
      path: BILLING_PORTAL_CONFIGURATIONS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(
    configurationId: string,
    options?: RequestOptions,
  ): Promise<BillingPortalConfigurationResponse> {
    return this._transport.request({
      path: buildPath(BILLING_PORTAL_CONFIGURATIONS_PATH, configurationId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateBillingPortalConfigurationPayload,
    options?: RequestOptions,
  ): Promise<BillingPortalConfigurationResponse> {
    return this._transport.request({
      path: BILLING_PORTAL_CONFIGURATIONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    configurationId: string,
    payload: UpdateBillingPortalConfigurationPayload,
    options?: RequestOptions,
  ): Promise<BillingPortalConfigurationResponse> {
    return this._transport.request({
      path: buildPath(BILLING_PORTAL_CONFIGURATIONS_PATH, configurationId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
