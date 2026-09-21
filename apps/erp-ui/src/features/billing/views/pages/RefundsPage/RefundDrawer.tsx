import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import { formatCurrency, formatDate } from '@common/utils/format';
import { Button } from '@heroui/react';
import { CurrencyEnum, RefundStatusEnum } from '@vxrerp/billing/contracts';
import { useRefundQuery } from '@vxrerp/sdk/react';
import { get } from 'lodash-es';

interface RefundDrawerProps {
  refundId: string;
  onClose: () => void;
}

export default function RefundDrawer({ refundId, onClose }: RefundDrawerProps) {
  const { data: refund } = useRefundQuery(refundId);

  const currency = get(refund, 'currency', CurrencyEnum.VND);
  const status = get(refund, 'status', RefundStatusEnum.PENDING);

  return (
    <EntityDrawer
      isOpen
      title={refundId}
      description={get(refund, 'chargeId', '')}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <DrawerSection title="Tóm tắt">
        <DetailList
          items={[
            { label: 'Trạng thái', value: <StatusChip status={status} /> },
            { label: 'Charge', value: get(refund, 'chargeId', '—') },
            { label: 'Payment intent', value: get(refund, 'paymentIntentId', '—') },
            { label: 'Hoá đơn', value: get(refund, 'invoiceId') ?? '—' },
            { label: 'Credit note', value: get(refund, 'creditNoteId') ?? '—' },
            { label: 'Khách hàng', value: get(refund, 'customerId', '—') },
            { label: 'Số tiền', value: formatCurrency(get(refund, 'amount', 0), currency) },
            { label: 'Lý do', value: get(refund, 'reason', '—') },
            { label: 'Lý do thất bại', value: get(refund, 'failureReason') ?? '—' },
            { label: 'Mã PSP', value: get(refund, 'pspReference', '—') },
            { label: 'Tạo lúc', value: formatDate(get(refund, 'createdAt', '')) },
          ]}
        />
      </DrawerSection>
    </EntityDrawer>
  );
}
