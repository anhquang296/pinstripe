'use client';

import { formatCurrency } from '@common/utils/format';
import { Card } from '@heroui/react';
import type { PortalInvoiceComparisonResponse } from '@vxrerp/sdk';
import { map } from 'lodash-es';

interface InvoiceComparisonCardProps {
  comparison: PortalInvoiceComparisonResponse;
}

function buildDifferenceLabel(difference: number, currency: string): string {
  if (difference > 0) {
    return `+${formatCurrency(difference, currency)}`;
  }

  return formatCurrency(difference, currency);
}

function resolveDifferenceClassName(difference: number): string {
  if (difference > 0) {
    return 'font-medium tabular-nums text-danger';
  }

  if (difference < 0) {
    return 'font-medium tabular-nums text-success';
  }

  return 'font-medium tabular-nums text-muted';
}

export default function InvoiceComparisonCard({ comparison }: InvoiceComparisonCardProps) {
  const { currency, previousInvoiceNumber, currentTotal, previousTotal, difference, lines } =
    comparison;

  if (previousInvoiceNumber) {
    return (
      <Card>
        <Card.Header className="flex flex-col gap-1">
          <Card.Title>So với kỳ trước</Card.Title>
          <Card.Description>
            Đối chiếu với hóa đơn {previousInvoiceNumber}: kỳ trước{' '}
            {formatCurrency(previousTotal, currency)}, kỳ này{' '}
            {formatCurrency(currentTotal, currency)}, chênh lệch{' '}
            {buildDifferenceLabel(difference, currency)}.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <dl className="flex flex-col gap-2">
            {map(lines, (line) => {
              return (
                <div key={line.description} className="flex justify-between gap-4">
                  <dt className="text-muted">{line.description}</dt>
                  <dd className={resolveDifferenceClassName(line.difference)}>
                    {buildDifferenceLabel(line.difference, currency)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card.Content>
      </Card>
    );
  }

  return null;
}
