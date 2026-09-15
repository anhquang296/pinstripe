import { Endpoint, Method, Params, Request } from '@api/client';

import type { EntitlementResponse, GetEntitlementsQuery, ListResponse } from './type';

const ENTITLEMENTS_PATH = '/v1/entitlements';

export function getEntitlements(
  query: GetEntitlementsQuery = {},
): Promise<ListResponse<EntitlementResponse>> {
  return Request<ListResponse<EntitlementResponse>>(
    Endpoint(ENTITLEMENTS_PATH),
    Method('GET'),
    Params(query),
  );
}
