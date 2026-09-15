import type {
  AdvanceTestClockPayload,
  CreateTestClockPayload,
  GetTestClocksQuery,
  ListResponse,
  TestClock,
} from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Payload, Request } from '@api/request';

const TEST_CLOCKS_PATH = '/v1/test_helpers/test_clocks';

export function getTestClocks(query: GetTestClocksQuery = {}): Promise<ListResponse<TestClock>> {
  return Request<ListResponse<TestClock>>(
    Endpoint(TEST_CLOCKS_PATH),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function createTestClock(payload: CreateTestClockPayload): Promise<TestClock> {
  return Request<TestClock>(
    Endpoint(TEST_CLOCKS_PATH),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}

export function advanceTestClock(
  testClockId: string,
  payload: AdvanceTestClockPayload,
): Promise<TestClock> {
  return Request<TestClock>(
    Endpoint(`${TEST_CLOCKS_PATH}/${encodeURIComponent(testClockId)}/advance`),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}
