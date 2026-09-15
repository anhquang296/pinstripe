import type { Entitlement, GetEntitlementsQuery, ListResponse } from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Request } from '@api/request';

const ENTITLEMENTS_PATH = '/v1/entitlements';

export function getEntitlements(
  query: GetEntitlementsQuery = {},
): Promise<ListResponse<Entitlement>> {
  return Request<ListResponse<Entitlement>>(
    Endpoint(ENTITLEMENTS_PATH),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}
