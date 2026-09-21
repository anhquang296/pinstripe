import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreatePortalMembershipPayload,
  DeletedPortalMembershipResponse,
  FindPortalMembershipsQuery,
  ListResponse,
  PortalMembershipResponse,
  UpdatePortalMembershipPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PORTAL_MEMBERSHIPS_PATH = '/v1/portal_memberships';

export class PortalMembershipsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindPortalMembershipsQuery,
    options?: RequestOptions,
  ): Promise<ListResponse<PortalMembershipResponse>> {
    return this._transport.request({
      path: PORTAL_MEMBERSHIPS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  create(
    payload: CreatePortalMembershipPayload,
    options?: RequestOptions,
  ): Promise<PortalMembershipResponse> {
    return this._transport.request({
      path: PORTAL_MEMBERSHIPS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    portalMembershipId: string,
    payload: UpdatePortalMembershipPayload,
    options?: RequestOptions,
  ): Promise<PortalMembershipResponse> {
    return this._transport.request({
      path: buildPath(PORTAL_MEMBERSHIPS_PATH, portalMembershipId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(
    portalMembershipId: string,
    options?: RequestOptions,
  ): Promise<DeletedPortalMembershipResponse> {
    return this._transport.request({
      path: buildPath(PORTAL_MEMBERSHIPS_PATH, portalMembershipId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
