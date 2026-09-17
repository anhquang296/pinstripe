import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateInvoiceItemPayload,
  DeletedInvoiceItemResponse,
  FindInvoiceItemsQuery,
  InvoiceItemResponse,
  ListResponse,
  UpdateInvoiceItemPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const INVOICE_ITEMS_PATH = '/v1/invoiceitems';

export class InvoiceItemsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindInvoiceItemsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<InvoiceItemResponse>> {
    return this._transport.request({
      path: INVOICE_ITEMS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(invoiceItemId: string, options?: RequestOptions): Promise<InvoiceItemResponse> {
    return this._transport.request({
      path: buildPath(INVOICE_ITEMS_PATH, invoiceItemId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateInvoiceItemPayload,
    options?: RequestOptions,
  ): Promise<InvoiceItemResponse> {
    return this._transport.request({
      path: INVOICE_ITEMS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    invoiceItemId: string,
    payload: UpdateInvoiceItemPayload,
    options?: RequestOptions,
  ): Promise<InvoiceItemResponse> {
    return this._transport.request({
      path: buildPath(INVOICE_ITEMS_PATH, invoiceItemId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(invoiceItemId: string, options?: RequestOptions): Promise<DeletedInvoiceItemResponse> {
    return this._transport.request({
      path: buildPath(INVOICE_ITEMS_PATH, invoiceItemId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
