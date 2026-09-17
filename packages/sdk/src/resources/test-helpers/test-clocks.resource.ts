import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  AdvanceTestClockPayload,
  CreateTestClockPayload,
  FindTestClocksQuery,
  ListResponse,
  TestClockResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const TEST_CLOCKS_PATH = '/v1/test_helpers/test_clocks';

export class TestClocksResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindTestClocksQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<TestClockResponse>> {
    return this._transport.request({
      path: TEST_CLOCKS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(testClockId: string, options?: RequestOptions): Promise<TestClockResponse> {
    return this._transport.request({
      path: buildPath(TEST_CLOCKS_PATH, testClockId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateTestClockPayload, options?: RequestOptions): Promise<TestClockResponse> {
    return this._transport.request({
      path: TEST_CLOCKS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  advance(
    testClockId: string,
    payload: AdvanceTestClockPayload,
    options?: RequestOptions,
  ): Promise<TestClockResponse> {
    return this._transport.request({
      path: buildPath(TEST_CLOCKS_PATH, testClockId, 'advance'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
