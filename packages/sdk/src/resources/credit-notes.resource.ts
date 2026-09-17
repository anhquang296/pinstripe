import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateCreditNotePayload,
  CreditNoteResponse,
  GetCreditNotesQuery,
  ListResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const CREDIT_NOTES_PATH = '/v1/credit_notes';

export class CreditNotesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(
    query: GetCreditNotesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CreditNoteResponse>> {
    return this._transport.request({
      path: CREDIT_NOTES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieve(creditNoteId: string, options?: RequestOptions): Promise<CreditNoteResponse> {
    return this._transport.request({
      path: buildPath(CREDIT_NOTES_PATH, creditNoteId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateCreditNotePayload, options?: RequestOptions): Promise<CreditNoteResponse> {
    return this._transport.request({
      path: CREDIT_NOTES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
