import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import { formatCurrency, formatDate } from '@common/utils/format';
import { Button } from '@heroui/react';
import { useCheckoutSessionQuery } from '@vxrerp/sdk/react';
import { get, toUpper } from 'lodash-es';

interface CheckoutSessionDrawerProps {
  checkoutSessionId: string;
  onClose: () => void;
}

export default function CheckoutSessionDrawer({
  checkoutSessionId,
  onClose,
}: CheckoutSessionDrawerProps) {
  const { data: checkoutSession } = useCheckoutSessionQuery(checkoutSessionId);

  const currency = get(checkoutSession, 'currency', 'vnd');

  return (
    <EntityDrawer
      isOpen
      title={checkoutSessionId}
      description={get(checkoutSession, 'customerId', '')}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Chế độ', value: get(checkoutSession, 'mode', '—') },
              {
                label: 'Trạng thái',
                value: <StatusChip status={get(checkoutSession, 'status', 'open')} />,
              },
              {
                label: 'Thanh toán',
                value: <StatusChip status={get(checkoutSession, 'paymentStatus', 'unpaid')} />,
              },
              { label: 'Tiền tệ', value: toUpper(currency) },
              {
                label: 'Tạm tính',
                value: formatCurrency(get(checkoutSession, 'amountSubtotal', 0), currency),
              },
              {
                label: 'Tổng',
                value: formatCurrency(get(checkoutSession, 'amountTotal', 0), currency),
              },
              { label: 'URL', value: get(checkoutSession, 'url') ?? '—' },
              { label: 'Hết hạn', value: formatDate(get(checkoutSession, 'expiresAt', '')) },
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Dòng hàng">
          <DataTable
            label="Dòng của phiên checkout"
            rows={get(checkoutSession, 'lineItems', [])}
            emptyMessage="Phiên này chưa có dòng hàng."
            columns={[
              {
                key: 'priceId',
                label: 'Bảng giá',
                isRowHeader: true,
                renderCell: (lineItem) => {
                  return lineItem.priceId;
                },
              },
              {
                key: 'quantity',
                label: 'Số lượng',
                renderCell: (lineItem) => {
                  return lineItem.quantity;
                },
              },
              {
                key: 'amountTotal',
                label: 'Thành tiền',
                renderCell: (lineItem) => {
                  return formatCurrency(lineItem.amountTotal, currency);
                },
              },
            ]}
          />
        </DrawerSection>

        <DrawerSection title="Kết quả">
          <DetailList
            items={[
              { label: 'Payment link', value: get(checkoutSession, 'paymentLinkId') ?? '—' },
              { label: 'Subscription', value: get(checkoutSession, 'subscriptionId') ?? '—' },
              { label: 'Invoice', value: get(checkoutSession, 'invoiceId') ?? '—' },
              { label: 'Payment intent', value: get(checkoutSession, 'paymentIntentId') ?? '—' },
            ]}
          />
        </DrawerSection>
      </div>
    </EntityDrawer>
  );
}
