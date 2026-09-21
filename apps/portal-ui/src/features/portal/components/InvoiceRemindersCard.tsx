'use client';

import { formatDateTime } from '@common/utils/format';
import { INVOICE_REMINDER_KIND_LABELS } from '@features/portal/constants/labels';
import { Card } from '@heroui/react';
import type { PortalInvoiceRemindersResponse } from '@vxrerp/sdk';
import { isEmpty, map } from 'lodash-es';

interface InvoiceRemindersCardProps {
  reminders: PortalInvoiceRemindersResponse['reminders'];
}

export default function InvoiceRemindersCard({ reminders }: InvoiceRemindersCardProps) {
  if (isEmpty(reminders)) {
    return null;
  }

  return (
    <Card>
      <Card.Header className="flex flex-col gap-1">
        <Card.Title>Vexere đã nhắc thanh toán</Card.Title>
        <Card.Description>
          Các thư nhắc đã gửi tới email thanh toán của nhà xe cho hóa đơn này.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <dl className="flex flex-col gap-2">
          {map(reminders, (reminder) => {
            return (
              <div key={reminder.kind} className="flex justify-between gap-4">
                <dt className="text-muted">{INVOICE_REMINDER_KIND_LABELS[reminder.kind]}</dt>
                <dd className="font-medium tabular-nums">{formatDateTime(reminder.sentAt)}</dd>
              </div>
            );
          })}
        </dl>
      </Card.Content>
    </Card>
  );
}
