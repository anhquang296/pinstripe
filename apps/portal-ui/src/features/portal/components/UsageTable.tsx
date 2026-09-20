'use client';

import DataTable from '@common/components/DataTable';
import { formatDate } from '@common/utils/format';
import type { PortalUsageResponse } from '@pinstripe/sdk';
import { map } from 'lodash-es';

type PortalUsageItem = PortalUsageResponse['items'][number];

interface UsageTableProps {
  items: PortalUsageItem[];
  isLoading: boolean;
}

const USAGE_NUMBER_FORMAT = new Intl.NumberFormat('vi-VN');

function buildIncludedLabel(includedQuantity: number | null): string {
  if (includedQuantity === null) {
    return 'Tính theo thực dùng';
  }

  return USAGE_NUMBER_FORMAT.format(includedQuantity);
}

function buildRemainingLabel(item: PortalUsageItem): string {
  const { includedQuantity, quantity } = item;

  if (includedQuantity === null) {
    return '—';
  }

  if (quantity > includedQuantity) {
    return `Vượt ${USAGE_NUMBER_FORMAT.format(quantity - includedQuantity)}`;
  }

  return `Còn ${USAGE_NUMBER_FORMAT.format(includedQuantity - quantity)}`;
}

export default function UsageTable({ items, isLoading }: UsageTableProps) {
  const rows = map(items, (item) => {
    return { ...item, id: item.subscriptionItemId };
  });

  const columns = [
    {
      key: 'productName',
      label: 'Dịch vụ',
      isRowHeader: true,
      renderCell: (row: PortalUsageItem) => {
        return row.productName;
      },
    },
    {
      key: 'meterName',
      label: 'Chỉ số đo',
      renderCell: (row: PortalUsageItem) => {
        return row.meterName;
      },
    },
    {
      key: 'period',
      label: 'Kỳ hiện tại',
      renderCell: (row: PortalUsageItem) => {
        return `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`;
      },
    },
    {
      key: 'quantity',
      label: 'Đã dùng',
      align: 'end' as const,
      renderCell: (row: PortalUsageItem) => {
        return USAGE_NUMBER_FORMAT.format(row.quantity);
      },
    },
    {
      key: 'includedQuantity',
      label: 'Trong gói',
      align: 'end' as const,
      renderCell: (row: PortalUsageItem) => {
        return buildIncludedLabel(row.includedQuantity);
      },
    },
    {
      key: 'remaining',
      label: 'Còn lại',
      align: 'end' as const,
      renderCell: (row: PortalUsageItem) => {
        return buildRemainingLabel(row);
      },
    },
  ];

  return (
    <DataTable
      label="Mức sử dụng kỳ này"
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      emptyMessage="Nhà xe chưa có dịch vụ nào tính theo mức sử dụng."
    />
  );
}
