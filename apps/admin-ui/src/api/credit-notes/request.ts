import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CreateCreditNotePayload,
  CreditNoteResponse,
  GetCreditNotesQuery,
  ListResponse,
} from './type';

const CREDIT_NOTES_PATH = '/v1/credit_notes';

export function getCreditNotes(
  query: GetCreditNotesQuery = {},
): Promise<ListResponse<CreditNoteResponse>> {
  return Request<ListResponse<CreditNoteResponse>>(
    Endpoint(CREDIT_NOTES_PATH),
    Method('GET'),
    Params(query),
  );
}

export function createCreditNote(payload: CreateCreditNotePayload): Promise<CreditNoteResponse> {
  return Request<CreditNoteResponse>(Endpoint(CREDIT_NOTES_PATH), Method('POST'), Payload(payload));
}
