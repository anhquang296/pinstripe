import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CreateMeterEventPayload,
  CreateMeterPayload,
  GetMeterEventSummariesQuery,
  GetMetersQuery,
  ListResponse,
  MeterEventResponse,
  MeterEventSummaryResponse,
  MeterResponse,
  UpdateMeterPayload,
} from './type';

const METERS_PATH = '/v1/billing/meters';
const METER_EVENTS_PATH = '/v1/billing/meter_events';

export function getMeters(query: GetMetersQuery = {}): Promise<ListResponse<MeterResponse>> {
  return Request<ListResponse<MeterResponse>>(Endpoint(METERS_PATH), Method('GET'), Params(query));
}

export function getMeter(meterId: string): Promise<MeterResponse> {
  return Request<MeterResponse>(
    Endpoint(`${METERS_PATH}/${encodeURIComponent(meterId)}`),
    Method('GET'),
  );
}

export function createMeter(payload: CreateMeterPayload): Promise<MeterResponse> {
  return Request<MeterResponse>(Endpoint(METERS_PATH), Method('POST'), Payload(payload));
}

export function updateMeter(meterId: string, payload: UpdateMeterPayload): Promise<MeterResponse> {
  return Request<MeterResponse>(
    Endpoint(`${METERS_PATH}/${encodeURIComponent(meterId)}`),
    Method('POST'),
    Payload(payload),
  );
}

export function getMeterEventSummary(
  meterId: string,
  query: GetMeterEventSummariesQuery,
): Promise<MeterEventSummaryResponse> {
  return Request<MeterEventSummaryResponse>(
    Endpoint(`${METERS_PATH}/${encodeURIComponent(meterId)}/event_summaries`),
    Method('GET'),
    Params(query),
  );
}

export function createMeterEvent(payload: CreateMeterEventPayload): Promise<MeterEventResponse> {
  return Request<MeterEventResponse>(Endpoint(METER_EVENTS_PATH), Method('POST'), Payload(payload));
}
