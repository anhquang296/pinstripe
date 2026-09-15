import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  AdvanceTestClockPayload,
  CreateTestClockPayload,
  GetTestClocksQuery,
  ListResponse,
  TestClockResponse,
} from './type';

const TEST_CLOCKS_PATH = '/v1/test_helpers/test_clocks';

export function getTestClocks(
  query: GetTestClocksQuery = {},
): Promise<ListResponse<TestClockResponse>> {
  return Request<ListResponse<TestClockResponse>>(
    Endpoint(TEST_CLOCKS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function createTestClock(payload: CreateTestClockPayload): Promise<TestClockResponse> {
  return Request<TestClockResponse>(Endpoint(TEST_CLOCKS_PATH), Method('POST'), Payload(payload));
}

export function advanceTestClock(
  testClockId: string,
  payload: AdvanceTestClockPayload,
): Promise<TestClockResponse> {
  return Request<TestClockResponse>(
    Endpoint(`${TEST_CLOCKS_PATH}/${encodeURIComponent(testClockId)}/advance`),
    Method('POST'),
    Payload(payload),
  );
}
