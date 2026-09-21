import { OPTION_LIMIT } from '@common/constants/pagination';
import type { InvoiceStatus } from '@vxrerp/core/contracts';
import { InvoiceStatusEnum } from '@vxrerp/core/contracts';
import type { InvoiceResponse, ListResponse } from '@vxrerp/sdk';
import { useInvoicesQuery } from '@vxrerp/sdk/react';
import { get, size } from 'lodash-es';

export type InvoiceStatusCountsResult = Record<InvoiceStatus, string>;

function toCountLabel(invoices: ListResponse<InvoiceResponse> | undefined): string {
  const rows = get(invoices, 'data', []);
  const hasMore = get(invoices, 'hasMore', false);

  if (hasMore) {
    return `${size(rows)}+`;
  }

  return `${size(rows)}`;
}

export function useInvoiceStatusCounts(): InvoiceStatusCountsResult {
  const { data: draftInvoices } = useInvoicesQuery({
    limit: OPTION_LIMIT,
    status: InvoiceStatusEnum.DRAFT,
  });

  const { data: openInvoices } = useInvoicesQuery({
    limit: OPTION_LIMIT,
    status: InvoiceStatusEnum.OPEN,
  });

  const { data: paidInvoices } = useInvoicesQuery({
    limit: OPTION_LIMIT,
    status: InvoiceStatusEnum.PAID,
  });

  const { data: voidInvoices } = useInvoicesQuery({
    limit: OPTION_LIMIT,
    status: InvoiceStatusEnum.VOID,
  });

  const { data: uncollectibleInvoices } = useInvoicesQuery({
    limit: OPTION_LIMIT,
    status: InvoiceStatusEnum.UNCOLLECTIBLE,
  });

  return {
    [InvoiceStatusEnum.DRAFT]: toCountLabel(draftInvoices),
    [InvoiceStatusEnum.OPEN]: toCountLabel(openInvoices),
    [InvoiceStatusEnum.PAID]: toCountLabel(paidInvoices),
    [InvoiceStatusEnum.VOID]: toCountLabel(voidInvoices),
    [InvoiceStatusEnum.UNCOLLECTIBLE]: toCountLabel(uncollectibleInvoices),
  };
}
