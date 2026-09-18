import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateUserPayload,
  FindUsersQuery,
  ListResponse,
  UpdateUserPayload,
  UserResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const USERS_PATH = '/api/v1/admin/users';

export class UsersResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(query: FindUsersQuery = {}, options?: RequestOptions): Promise<ListResponse<UserResponse>> {
    return this._transport.request({
      path: USERS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(userId: string, options?: RequestOptions): Promise<UserResponse> {
    return this._transport.request({
      path: buildPath(USERS_PATH, userId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateUserPayload, options?: RequestOptions): Promise<UserResponse> {
    return this._transport.request({
      path: USERS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    userId: string,
    payload: UpdateUserPayload,
    options?: RequestOptions,
  ): Promise<UserResponse> {
    return this._transport.request({
      path: buildPath(USERS_PATH, userId),
      method: HttpMethodEnum.PATCH,
      payload,
      options,
    });
  }
}
