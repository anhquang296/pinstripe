import { Endpoint, Method, Request } from '@api/request';

const ADMIN_PATH = '/api/v1/admin';

export interface AdminPingResponse {
  object: string;
}

export function getAdminPing(): Promise<AdminPingResponse> {
  return Request<AdminPingResponse>(Endpoint(`${ADMIN_PATH}/ping`), Method('GET'));
}
