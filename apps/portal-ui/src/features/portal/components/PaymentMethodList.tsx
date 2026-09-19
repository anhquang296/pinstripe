import { Card } from '@heroui/react';
import type { PaymentMethodResponse } from '@pinstripe/sdk';
import { isEmpty, map, padStart, toUpper } from 'lodash-es';

interface PaymentMethodListProps {
  paymentMethods: PaymentMethodResponse[];
}

function buildPaymentMethodLabel(paymentMethod: PaymentMethodResponse): string {
  const { card } = paymentMethod;

  if (card) {
    const expiryLabel = `${padStart(String(card.expMonth), 2, '0')}/${card.expYear}`;

    return `${toUpper(card.brand)} •••• ${card.last4} — hết hạn ${expiryLabel}`;
  }

  return toUpper(paymentMethod.type);
}

export default function PaymentMethodList({ paymentMethods }: PaymentMethodListProps) {
  return (
    <Card>
      <Card.Header className="flex flex-col gap-1">
        <Card.Title>Phương thức thanh toán đã lưu</Card.Title>
        <Card.Description>
          Dùng cho các gói thu tự động. Để thêm hoặc thay thẻ, liên hệ kế toán Vexere.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {isEmpty(paymentMethods) ? (
          <span className="text-sm text-muted">Nhà xe chưa lưu phương thức thanh toán nào.</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {map(paymentMethods, (paymentMethod) => {
              return <li key={paymentMethod.id}>{buildPaymentMethodLabel(paymentMethod)}</li>;
            })}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}
