import ConfirmDialog from '@common/components/ConfirmDialog';
import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import DrawerTabs from '@common/components/DrawerTabs';
import EntityDrawer from '@common/components/EntityDrawer';
import RowActionButton from '@common/components/RowActionButton';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import type { SubscriptionItemFormData } from '@common/forms/subscription-item-form';
import {
  subscriptionItemFormDataToPayload,
  subscriptionItemFormDataToUpdatePayload,
  subscriptionItemFormDefaultValues,
  subscriptionItemFormResolver,
  subscriptionItemToFormData,
} from '@common/forms/subscription-item-form';
import type { SubscriptionUpdateFormData } from '@common/forms/subscription-update-form';
import {
  subscriptionToUpdateFormData,
  subscriptionUpdateFormDataToPayload,
  subscriptionUpdateFormDefaultValues,
  subscriptionUpdateFormResolver,
} from '@common/forms/subscription-update-form';
import { formatCurrency, formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import SubscriptionItemForm from '@features/dashboard/components/SubscriptionItemForm';
import SubscriptionUpdateForm from '@features/dashboard/components/SubscriptionUpdateForm';
import { Pencil, TrashBin } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCancelSubscriptionMutation,
  useCreateSubscriptionItemMutation,
  useDeleteSubscriptionItemMutation,
  useEntitlementsQuery,
  usePricesQuery,
  useSubscriptionItemQuery,
  useSubscriptionItemsQuery,
  useSubscriptionQuery,
  useUpcomingInvoiceQuery,
  useUpdateSubscriptionItemMutation,
  useUpdateSubscriptionMutation,
} from '@pinstripe/sdk/react';
import { get, map, size } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

const DETAIL_TAB = 'detail';
const ENTITLEMENT_TAB = 'entitlement';
const UPCOMING_TAB = 'upcoming';

const TABS = [
  { key: DETAIL_TAB, label: 'Chi tiết' },
  { key: ENTITLEMENT_TAB, label: 'Entitlements' },
  { key: UPCOMING_TAB, label: 'Hoá đơn sắp tới' },
];

interface SubscriptionDrawerProps {
  subscriptionId: string;
  onClose: () => void;
}

export default function SubscriptionDrawer({ subscriptionId, onClose }: SubscriptionDrawerProps) {
  const [activeTab, setActiveTab] = useState(DETAIL_TAB);
  const [editingItemId, setEditingItemId] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const canWrite = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: subscription } = useSubscriptionQuery(subscriptionId);
  const { data: subscriptionItems } = useSubscriptionItemsQuery({
    subscriptionId,
    limit: PAGE_LIMIT,
  });
  const { data: subscriptionItem } = useSubscriptionItemQuery(editingItemId, {
    enabled: Boolean(editingItemId),
  });
  const { data: prices } = usePricesQuery({ limit: OPTION_LIMIT, active: true });
  const customerId = get(subscription, 'customerId', '');
  const { data: entitlements } = useEntitlementsQuery(
    { customerId, limit: PAGE_LIMIT },
    { enabled: activeTab === ENTITLEMENT_TAB && Boolean(customerId) },
  );
  const { data: upcomingInvoice } = useUpcomingInvoiceQuery(subscriptionId, {
    enabled: activeTab === UPCOMING_TAB,
  });

  const { mutateAsync: updateSubscription, isPending: isSaving } = useUpdateSubscriptionMutation({
    successMessage: 'Đã cập nhật subscription.',
  });
  const { mutateAsync: cancelSubscription, isPending: isCanceling } = useCancelSubscriptionMutation(
    { successMessage: 'Đã hủy subscription.' },
  );
  const { mutateAsync: createSubscriptionItem, isPending: isCreatingItem } =
    useCreateSubscriptionItemMutation({ successMessage: 'Đã thêm dòng thuê bao.' });
  const { mutateAsync: updateSubscriptionItem, isPending: isUpdatingItem } =
    useUpdateSubscriptionItemMutation({ successMessage: 'Đã cập nhật dòng thuê bao.' });
  const { mutate: deleteSubscriptionItem } = useDeleteSubscriptionItemMutation({
    successMessage: 'Đã gỡ dòng thuê bao.',
  });

  const subscriptionForm = useForm<SubscriptionUpdateFormData>({
    resolver: subscriptionUpdateFormResolver,
    defaultValues: subscriptionUpdateFormDefaultValues,
  });
  const itemForm = useForm<SubscriptionItemFormData>({
    resolver: subscriptionItemFormResolver,
    defaultValues: subscriptionItemFormDefaultValues,
  });

  useEffect(() => {
    if (subscription) {
      subscriptionForm.reset(subscriptionToUpdateFormData(subscription));
    }
  }, [subscription, subscriptionForm]);

  useEffect(() => {
    if (subscriptionItem) {
      itemForm.reset(subscriptionItemToFormData(subscriptionItem));
    }
  }, [subscriptionItem, itemForm]);

  const priceOptions = [
    { value: '', label: '— chọn bảng giá —' },
    ...map(get(prices, 'data', []), (price) => {
      const { lookupKey } = price;
      const priceName = lookupKey === null ? price.id : lookupKey;

      return { value: price.id, label: `${priceName} · ${formatPriceAmount(price)}` };
    }),
  ];

  const handleOnSave = subscriptionForm.handleSubmit(async (formData) => {
    await updateSubscription({
      id: subscriptionId,
      payload: subscriptionUpdateFormDataToPayload(formData),
    });
  });

  const handleOnSaveItem = itemForm.handleSubmit(async (formData) => {
    if (editingItemId) {
      await updateSubscriptionItem({
        id: editingItemId,
        payload: subscriptionItemFormDataToUpdatePayload(formData),
      });
      setEditingItemId('');
    } else {
      await createSubscriptionItem(subscriptionItemFormDataToPayload(subscriptionId, formData));
    }

    itemForm.reset(subscriptionItemFormDefaultValues);
  });

  const handleOnCancelItem = () => {
    setEditingItemId('');
    itemForm.reset(subscriptionItemFormDefaultValues);
  };

  const handleOnCancelSubscription = async () => {
    await cancelSubscription({ id: subscriptionId, payload: { cancelAtPeriodEnd: true } });
    setIsCancelOpen(false);
  };

  return (
    <EntityDrawer
      isOpen
      title={subscriptionId}
      description={customerId}
      tabs={<DrawerTabs items={TABS} activeKey={activeTab} onSelect={setActiveTab} />}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Đóng
          </Button>
          {canWrite ? (
            <Button
              variant="danger"
              onPress={() => {
                setIsCancelOpen(true);
              }}
            >
              Hủy thuê bao
            </Button>
          ) : null}
        </>
      }
      onOpenChange={onClose}
    >
      {activeTab === DETAIL_TAB ? (
        <div className="flex flex-col gap-4">
          <DrawerSection title="Tóm tắt">
            <DetailList
              items={[
                { label: 'Khách hàng', value: customerId },
                {
                  label: 'Trạng thái',
                  value: <StatusChip status={get(subscription, 'status', 'incomplete')} />,
                },
                { label: 'Cách thu tiền', value: get(subscription, 'collectionMethod', '—') },
                { label: 'Chế độ tính tiền', value: get(subscription, 'billingMode', '—') },
                {
                  label: 'Kỳ hiện tại',
                  value: `${formatDate(get(subscription, 'currentPeriodStart', ''))} → ${formatDate(get(subscription, 'currentPeriodEnd', ''))}`,
                },
                { label: 'Hết trial', value: formatDate(get(subscription, 'trialEnd') ?? '') },
              ]}
            />
          </DrawerSection>

          {canWrite ? (
            <DrawerSection title="Sửa thuê bao">
              <SubscriptionUpdateForm
                form={subscriptionForm}
                isSaving={isSaving}
                onSave={handleOnSave}
              />
            </DrawerSection>
          ) : null}

          <DrawerSection title="Dòng thuê bao">
            <DataTable
              label="Subscription items"
              rows={get(subscriptionItems, 'data', [])}
              emptyMessage="Thuê bao này chưa có dòng nào."
              columns={[
                {
                  key: 'priceId',
                  label: 'Bảng giá',
                  isRowHeader: true,
                  renderCell: (item) => {
                    return item.priceId;
                  },
                },
                {
                  key: 'quantity',
                  label: 'Số lượng',
                  renderCell: (item) => {
                    return item.quantity;
                  },
                },
                {
                  key: 'createdAt',
                  label: 'Tạo lúc',
                  renderCell: (item) => {
                    return formatDate(item.createdAt);
                  },
                },
                {
                  key: 'actions',
                  label: 'Thao tác',
                  align: 'end',
                  renderCell: (item) => {
                    if (!canWrite) {
                      return null;
                    }

                    return (
                      <>
                        <RowActionButton
                          label="Sửa"
                          icon={<Pencil />}
                          onPress={() => {
                            setEditingItemId(item.id);
                          }}
                        />
                        <RowActionButton
                          label="Gỡ"
                          icon={<TrashBin />}
                          isDanger
                          onPress={() => {
                            deleteSubscriptionItem({ id: item.id });
                          }}
                        />
                      </>
                    );
                  },
                },
              ]}
            />
          </DrawerSection>

          {canWrite ? (
            <DrawerSection title={editingItemId ? 'Sửa dòng thuê bao' : 'Thêm dòng thuê bao'}>
              <SubscriptionItemForm
                mode={editingItemId ? 'edit' : 'create'}
                form={itemForm}
                priceOptions={priceOptions}
                isSaving={isCreatingItem || isUpdatingItem}
                onSave={handleOnSaveItem}
                onCancel={handleOnCancelItem}
              />
            </DrawerSection>
          ) : null}
        </div>
      ) : null}

      {activeTab === ENTITLEMENT_TAB ? (
        <DataTable
          label="Entitlements"
          rows={get(entitlements, 'data', [])}
          emptyMessage="Khách này chưa có quyền dùng nào."
          columns={[
            {
              key: 'productId',
              label: 'Product',
              isRowHeader: true,
              renderCell: (entitlement) => {
                return entitlement.productId;
              },
            },
            {
              key: 'subscriptionId',
              label: 'Subscription',
              renderCell: (entitlement) => {
                return entitlement.subscriptionId;
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (entitlement) => {
                return <StatusChip status={entitlement.status} />;
              },
            },
            {
              key: 'grantedAt',
              label: 'Cấp lúc',
              renderCell: (entitlement) => {
                return formatDate(entitlement.grantedAt);
              },
            },
          ]}
        />
      ) : null}

      {activeTab === UPCOMING_TAB ? (
        <DrawerSection title="Hoá đơn sắp tới">
          {upcomingInvoice ? (
            <div className="flex flex-col gap-4">
              <DetailList
                items={[
                  { label: 'Kỳ bắt đầu', value: formatDate(upcomingInvoice.periodStart) },
                  { label: 'Kỳ kết thúc', value: formatDate(upcomingInvoice.periodEnd) },
                  { label: 'Số dòng', value: size(upcomingInvoice.lineItems) },
                  {
                    label: 'Tổng',
                    value: formatCurrency(upcomingInvoice.total, upcomingInvoice.currency),
                  },
                ]}
              />

              <DataTable
                label="Dòng hoá đơn sắp tới"
                rows={map(upcomingInvoice.lineItems, (lineItem, index) => {
                  return { ...lineItem, id: `line-${index}` };
                })}
                emptyMessage="Chưa có dòng nào."
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
                    key: 'type',
                    label: 'Loại',
                    renderCell: (lineItem) => {
                      return lineItem.type;
                    },
                  },
                  {
                    key: 'quantity',
                    label: 'Số lượng',
                    renderCell: (lineItem) => {
                      return lineItem.ratedQuantity;
                    },
                  },
                  {
                    key: 'amount',
                    label: 'Thành tiền',
                    renderCell: (lineItem) => {
                      return formatCurrency(lineItem.amount, upcomingInvoice.currency);
                    },
                  },
                ]}
              />
            </div>
          ) : (
            <span className="text-app-label text-[13px]">Thuê bao này chưa có hoá đơn kỳ tới.</span>
          )}
        </DrawerSection>
      ) : null}

      <ConfirmDialog
        isOpen={isCancelOpen}
        title="Hủy thuê bao"
        description="Thuê bao sẽ dừng vào cuối kỳ hiện tại; khách vẫn dùng tới hết kỳ đã trả tiền."
        confirmLabel="Hủy cuối kỳ"
        isConfirming={isCanceling}
        onConfirm={handleOnCancelSubscription}
        onOpenChange={setIsCancelOpen}
      />
    </EntityDrawer>
  );
}
