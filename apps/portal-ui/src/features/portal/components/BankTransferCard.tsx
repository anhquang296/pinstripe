'use client';

import DetailList from '@common/components/DetailList';
import { formatCurrency } from '@common/utils/format';
import { Card } from '@heroui/react';
import type { PortalBankTransferResponse } from '@pinstripe/sdk';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface BankTransferCardProps {
  bankTransfer: PortalBankTransferResponse;
}

export default function BankTransferCard({ bankTransfer }: BankTransferCardProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const { qrPayload } = bankTransfer;

  useEffect(() => {
    let isCurrent = true;

    void QRCode.toDataURL(qrPayload, { margin: 1, width: 220 }).then((imageUrl) => {
      if (isCurrent) {
        setQrImageUrl(imageUrl);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [qrPayload]);

  return (
    <Card>
      <Card.Header className="flex flex-col gap-1">
        <Card.Title>Thanh toán bằng chuyển khoản</Card.Title>
        <Card.Description>
          Quét mã VietQR bằng ứng dụng ngân hàng, hoặc chuyển khoản theo thông tin bên dưới. Giữ
          nguyên nội dung chuyển khoản để kế toán Vexere đối soát và cập nhật trạng thái hóa đơn.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex size-[220px] shrink-0 items-center justify-center rounded-lg bg-white">
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="Mã VietQR chuyển khoản" width={220} height={220} />
          ) : null}
        </div>
        <DetailList
          items={[
            { label: 'Ngân hàng', value: bankTransfer.bankName },
            { label: 'Số tài khoản', value: bankTransfer.accountNumber },
            { label: 'Chủ tài khoản', value: bankTransfer.accountName },
            {
              label: 'Số tiền',
              value: formatCurrency(bankTransfer.amount, bankTransfer.currency),
            },
            {
              label: 'Nội dung chuyển khoản',
              value: (
                <span className="font-mono font-semibold">{bankTransfer.transferContent}</span>
              ),
            },
          ]}
        />
      </Card.Content>
    </Card>
  );
}
