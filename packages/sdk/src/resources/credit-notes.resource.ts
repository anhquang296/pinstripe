import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateCreditNotePayload,
  CreditNoteResponse,
  FindCreditNotesQuery,
  ListResponse,
  VoidCreditNotePayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const CREDIT_NOTES_PATH = '/v1/credit_notes';

export class CreditNotesResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindCreditNotesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CreditNoteResponse>> {
    return this._transport.request({
      path: CREDIT_NOTES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(creditNoteId: string, options?: RequestOptions): Promise<CreditNoteResponse> {
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

  void(
    creditNoteId: string,
    payload: VoidCreditNotePayload = {},
    options?: RequestOptions,
  ): Promise<CreditNoteResponse> {
    return this._transport.request({
      path: buildPath(CREDIT_NOTES_PATH, creditNoteId, 'void'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
