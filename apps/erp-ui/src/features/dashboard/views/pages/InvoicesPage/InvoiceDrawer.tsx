import ConfirmDialog from '@common/components/ConfirmDialog';
import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import DrawerTabs from '@common/components/DrawerTabs';
import EntityDrawer from '@common/components/EntityDrawer';
import RowActionButton from '@common/components/RowActionButton';
import StatusChip from '@common/components/StatusChip';
import { COLLECTION_METHOD_LABELS } from '@common/constants/collection-method';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { CreditNoteFormData } from '@common/forms/credit-note-form';
import {
  creditNoteFormDataToPayload,
  creditNoteFormDefaultValues,
  creditNoteFormResolver,
} from '@common/forms/credit-note-form';
import type { InvoiceItemFormData } from '@common/forms/invoice-item-form';
import {
  invoiceItemFormDataToPayload,
  invoiceItemFormDataToUpdatePayload,
  invoiceItemFormDefaultValues,
  invoiceItemFormResolver,
  invoiceItemToFormData,
} from '@common/forms/invoice-item-form';
import { formatCurrency, formatDate } from '@common/utils/format';
import CreditNoteForm from '@features/dashboard/components/CreditNoteForm';
import InvoiceItemForm from '@features/dashboard/components/InvoiceItemForm';
import { TrashBin } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { toast } from '@libs/toast';
import type { PaymentIntentResponse } from '@vxrerp/core/contracts';
import {
  CollectionMethodEnum,
  CreditNoteStatusEnum,
  CurrencyEnum,
  InvoiceStatusEnum,
  PermissionEnum,
} from '@vxrerp/core/contracts';
import {
  useChargeInvoiceMutation,
  useCreateCreditNoteMutation,
  useCreateInvoiceItemMutation,
  useCreditNoteQuery,
  useCreditNotesQuery,
  useDeleteInvoiceItemMutation,
  useFinalizeInvoiceMutation,
  useInvoiceItemQuery,
  useInvoiceItemsQuery,
  useInvoiceQuery,
  usePayInvoiceMutation,
  useUpdateInvoiceItemMutation,
  useVoidCreditNoteMutation,
  useVoidInvoiceMutation,
} from '@vxrerp/sdk/react';
import { get, toUpper } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

const DETAIL_TAB = 'detail';
const CREDIT_NOTE_TAB = 'credit_note';

const TABS = [
  { key: DETAIL_TAB, label: 'Chi tiết' },
  { key: CREDIT_NOTE_TAB, label: 'Credit notes' },
];

interface InvoiceDrawerProps {
  invoiceId: string;
  onClose: () => void;
}

export default function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const [activeTab, setActiveTab] = useState(DETAIL_TAB);

  const [selectedInvoiceItemId, setSelectedInvoiceItemId] = useState('');

  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState('');

  const [isVoidOpen, setIsVoidOpen] = useState(false);

  const [isVoidCreditNoteOpen, setIsVoidCreditNoteOpen] = useState(false);

  const canWrite = useCan(PermissionEnum.INVOICE_WRITE);
  const canVoid = useCan(PermissionEnum.INVOICE_VOID);
  const canWriteCreditNote = useCan(PermissionEnum.CREDIT_NOTE_WRITE);
  const canRefund = useCan(PermissionEnum.REFUND_WRITE);

  const { data: invoice } = useInvoiceQuery(invoiceId);

  const { data: invoiceItems } = useInvoiceItemsQuery(
    { invoiceId, limit: PAGE_LIMIT },
    { enabled: activeTab === DETAIL_TAB },
  );

  const { data: invoiceItem } = useInvoiceItemQuery(selectedInvoiceItemId, {
    enabled: Boolean(selectedInvoiceItemId),
  });

  const { data: creditNotes } = useCreditNotesQuery(
    { invoiceId, limit: PAGE_LIMIT },
    { enabled: activeTab === CREDIT_NOTE_TAB },
  );

  const { data: creditNote } = useCreditNoteQuery(selectedCreditNoteId, {
    enabled: Boolean(selectedCreditNoteId),
  });

  const { mutate: finalizeInvoice, isPending: isFinalizing } = useFinalizeInvoiceMutation({
    successMessage: (finalizedInvoice) => {
      if (finalizedInvoice.number) {
        return `Đã phát hành ${finalizedInvoice.number}.`;
      }

      return 'Đã phát hành hoá đơn.';
    },
  });

  const { mutate: payInvoice, isPending: isPaying } = usePayInvoiceMutation({
    successMessage: 'Đã ghi nhận thanh toán.',
  });

  const { mutateAsync: voidInvoice, isPending: isVoiding } = useVoidInvoiceMutation({
    successMessage: 'Đã huỷ hoá đơn.',
  });

  const { mutate: chargeInvoice, isPending: isCharging } = useChargeInvoiceMutation();

  const { mutateAsync: createInvoiceItem, isPending: isAddingItem } = useCreateInvoiceItemMutation({
    successMessage: 'Đã thêm dòng hoá đơn.',
  });

  const { mutateAsync: updateInvoiceItem, isPending: isSavingItem } = useUpdateInvoiceItemMutation({
    successMessage: 'Đã cập nhật dòng hoá đơn.',
  });

  const { mutate: deleteInvoiceItem } = useDeleteInvoiceItemMutation({
    successMessage: 'Đã xoá dòng hoá đơn.',
  });

  const { mutateAsync: createCreditNote, isPending: isCrediting } = useCreateCreditNoteMutation({
    successMessage: (createdCreditNote) => {
      return `Đã tạo ${createdCreditNote.number}.`;
    },
  });

  const { mutateAsync: voidCreditNote, isPending: isVoidingCreditNote } = useVoidCreditNoteMutation(
    { successMessage: 'Đã huỷ credit note.' },
  );

  const invoiceItemForm = useForm<InvoiceItemFormData>({
    resolver: invoiceItemFormResolver,
    defaultValues: invoiceItemFormDefaultValues,
  });

  const creditNoteForm = useForm<CreditNoteFormData>({
    resolver: creditNoteFormResolver,
    defaultValues: creditNoteFormDefaultValues,
  });

  useEffect(() => {
    if (invoiceItem) {
      invoiceItemForm.reset(invoiceItemToFormData(invoiceItem));
    }
  }, [invoiceItem, invoiceItemForm]);

  const currency = get(invoice, 'currency', CurrencyEnum.VND);
  const invoiceStatus = get(invoice, 'status', InvoiceStatusEnum.DRAFT);
  const customerId = get(invoice, 'customerId', '');
  const isDraft = invoiceStatus === InvoiceStatusEnum.DRAFT;
  const isOpen = invoiceStatus === InvoiceStatusEnum.OPEN;

  const handleOnSaveItem = invoiceItemForm.handleSubmit(async (formData) => {
    if (selectedInvoiceItemId) {
      await updateInvoiceItem({
        id: selectedInvoiceItemId,
        payload: invoiceItemFormDataToUpdatePayload(formData),
      });
      setSelectedInvoiceItemId('');
    } else {
      await createInvoiceItem(invoiceItemFormDataToPayload(customerId, invoiceId, formData));
    }

    invoiceItemForm.reset(invoiceItemFormDefaultValues);
  });

  const handleOnCreateCreditNote = creditNoteForm.handleSubmit(async (formData) => {
    await createCreditNote(creditNoteFormDataToPayload(invoiceId, formData));
    creditNoteForm.reset(creditNoteFormDefaultValues);
  });

  const handleOnFinalize = () => {
    finalizeInvoice(invoiceId);
  };

  const handleOnPay = () => {
    payInvoice({ id: invoiceId, payload: {} });
  };

  const handleOnCharge = () => {
    chargeInvoice(
      { invoiceId },
      {
        onSuccess: (paymentIntent: PaymentIntentResponse) => {
          const { failureMessage } = paymentIntent;

          if (failureMessage) {
            toast.show(failureMessage, { isError: true });

            return;
          }

          toast.show(`Đã gửi yêu cầu thu tiền, intent đang ${paymentIntent.status}.`);
        },
      },
    );
  };

  const handleOnVoid = async () => {
    await voidInvoice({ id: invoiceId, payload: {} });
    setIsVoidOpen(false);
    onClose();
  };

  const handleOnVoidCreditNote = async () => {
    await voidCreditNote({ id: selectedCreditNoteId, payload: {} });
    setIsVoidCreditNoteOpen(false);
  };

  return (
    <EntityDrawer
      isOpen
      title={get(invoice, 'number') || invoiceId}
      description={`${customerId} · ${toUpper(currency)}`}
      tabs={<DrawerTabs items={TABS} activeKey={activeTab} onSelect={setActiveTab} />}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Đóng
          </Button>
          {canWrite && isDraft ? (
            <Button isDisabled={isFinalizing} onPress={handleOnFinalize}>
              Phát hành
            </Button>
          ) : null}
          {canWrite && isOpen ? (
            <Button variant="ghost" isDisabled={isPaying} onPress={handleOnPay}>
              Ghi nhận đã trả
            </Button>
          ) : null}
          {canRefund && isOpen ? (
            <Button variant="ghost" isDisabled={isCharging} onPress={handleOnCharge}>
              Thu tiền qua PSP
            </Button>
          ) : null}
          {canVoid && (isDraft || isOpen) ? (
            <Button
              variant="danger"
              onPress={() => {
                setIsVoidOpen(true);
              }}
            >
              Huỷ hoá đơn
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
                { label: 'ID', value: invoiceId },
                { label: 'Trạng thái', value: <StatusChip status={invoiceStatus} /> },
                { label: 'Khách hàng', value: customerId },
                { label: 'Subscription', value: get(invoice, 'subscriptionId') || '—' },
                {
                  label: 'Cách thu tiền',
                  value:
                    COLLECTION_METHOD_LABELS[
                      get(invoice, 'collectionMethod', CollectionMethodEnum.CHARGE_AUTOMATICALLY)
                    ],
                },
                { label: 'Lý do phát sinh', value: get(invoice, 'billingReason', '—') },
                {
                  label: 'Kỳ',
                  value: `${formatDate(get(invoice, 'periodStart', ''))} → ${formatDate(get(invoice, 'periodEnd', ''))}`,
                },
                { label: 'Phát hành lúc', value: formatDate(get(invoice, 'finalizedAt') ?? '') },
              ]}
            />
          </DrawerSection>

          <DrawerSection title="Tổng tiền">
            <DetailList
              items={[
                {
                  label: 'Tạm tính',
                  value: formatCurrency(get(invoice, 'subtotal', 0), currency),
                },
                {
                  label: 'Giảm giá',
                  value: formatCurrency(get(invoice, 'totalDiscountAmount', 0), currency),
                },
                {
                  label: 'Thuế',
                  value: formatCurrency(get(invoice, 'totalTaxAmount', 0), currency),
                },
                { label: 'Tổng', value: formatCurrency(get(invoice, 'total', 0), currency) },
                {
                  label: 'Đã trả',
                  value: formatCurrency(get(invoice, 'amountPaid', 0), currency),
                },
                {
                  label: 'Đã ghi có',
                  value: formatCurrency(get(invoice, 'amountCredited', 0), currency),
                },
                {
                  label: 'Đã hoàn',
                  value: formatCurrency(get(invoice, 'amountRefunded', 0), currency),
                },
                {
                  label: 'Còn lại',
                  value: formatCurrency(get(invoice, 'amountRemaining', 0), currency),
                },
              ]}
            />
          </DrawerSection>

          <DataTable
            label="Dòng hoá đơn"
            rows={get(invoice, 'lineItems', [])}
            emptyMessage="Hoá đơn này chưa có dòng nào."
            columns={[
              {
                key: 'description',
                label: 'Diễn giải',
                isRowHeader: true,
                renderCell: (lineItem) => {
                  return lineItem.description;
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
                key: 'amount',
                label: 'Thành tiền',
                renderCell: (lineItem) => {
                  return formatCurrency(lineItem.amount, currency);
                },
              },
              {
                key: 'type',
                label: 'Loại',
                renderCell: (lineItem) => {
                  return lineItem.type;
                },
              },
            ]}
          />

          {canWrite && isDraft ? (
            <DrawerSection
              title={selectedInvoiceItemId ? 'Sửa dòng chờ xuất' : 'Thêm dòng chờ xuất'}
            >
              <InvoiceItemForm
                mode={selectedInvoiceItemId ? 'edit' : 'create'}
                form={invoiceItemForm}
                isSaving={isAddingItem || isSavingItem}
                onSave={handleOnSaveItem}
              />
            </DrawerSection>
          ) : null}

          {isDraft ? (
            <DataTable
              label="Invoice items"
              rows={get(invoiceItems, 'data', [])}
              emptyMessage="Chưa có invoice item nào gắn vào hoá đơn này."
              onRowAction={(row) => {
                setSelectedInvoiceItemId(row.id);
              }}
              columns={[
                {
                  key: 'description',
                  label: 'Diễn giải',
                  isRowHeader: true,
                  renderCell: (row) => {
                    return row.description;
                  },
                },
                {
                  key: 'quantity',
                  label: 'Số lượng',
                  renderCell: (row) => {
                    return row.quantity;
                  },
                },
                {
                  key: 'amount',
                  label: 'Thành tiền',
                  renderCell: (row) => {
                    return formatCurrency(row.amount, row.currency);
                  },
                },
                {
                  key: 'actions',
                  label: 'Thao tác',
                  align: 'end',
                  renderCell: (row) => {
                    if (!canWrite) {
                      return null;
                    }

                    return (
                      <RowActionButton
                        label="Xoá"
                        icon={<TrashBin />}
                        isDanger
                        onPress={() => {
                          deleteInvoiceItem(row.id);
                        }}
                      />
                    );
                  },
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === CREDIT_NOTE_TAB ? (
        <div className="flex flex-col gap-4">
          {canWriteCreditNote ? (
            <DrawerSection title="Tạo credit note">
              <CreditNoteForm
                form={creditNoteForm}
                isSaving={isCrediting}
                onSave={handleOnCreateCreditNote}
              />
            </DrawerSection>
          ) : null}

          <DataTable
            label="Credit notes"
            rows={get(creditNotes, 'data', [])}
            emptyMessage="Hoá đơn này chưa có credit note."
            onRowAction={(row) => {
              setSelectedCreditNoteId(row.id);
            }}
            columns={[
              {
                key: 'number',
                label: 'Số',
                isRowHeader: true,
                renderCell: (row) => {
                  return row.number;
                },
              },
              {
                key: 'status',
                label: 'Trạng thái',
                renderCell: (row) => {
                  return <StatusChip status={row.status} />;
                },
              },
              {
                key: 'amount',
                label: 'Số tiền',
                renderCell: (row) => {
                  return formatCurrency(row.amount, row.currency);
                },
              },
              {
                key: 'reason',
                label: 'Lý do',
                renderCell: (row) => {
                  return row.reason;
                },
              },
              {
                key: 'createdAt',
                label: 'Tạo lúc',
                renderCell: (row) => {
                  return formatDate(row.createdAt);
                },
              },
            ]}
          />

          {creditNote ? (
            <DrawerSection
              title={`Chi tiết ${creditNote.number}`}
              actions={
                canWriteCreditNote && creditNote.status !== CreditNoteStatusEnum.VOID ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      setIsVoidCreditNoteOpen(true);
                    }}
                  >
                    Huỷ credit note
                  </Button>
                ) : null
              }
            >
              <DetailList
                items={[
                  { label: 'ID', value: creditNote.id },
                  { label: 'Loại', value: creditNote.type },
                  {
                    label: 'Ghi có',
                    value: formatCurrency(creditNote.creditAmount, creditNote.currency),
                  },
                  {
                    label: 'Hoàn tiền',
                    value: formatCurrency(creditNote.refundAmount, creditNote.currency),
                  },
                  { label: 'Refund', value: creditNote.refundId ?? '—' },
                  { label: 'Huỷ lúc', value: formatDate(creditNote.voidedAt ?? '') || '—' },
                ]}
              />
            </DrawerSection>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={isVoidOpen}
        title="Huỷ hoá đơn"
        description="Hoá đơn đã huỷ không quay lại được. Số hoá đơn vẫn giữ nguyên trong sổ."
        confirmLabel="Huỷ hoá đơn"
        isConfirming={isVoiding}
        onConfirm={handleOnVoid}
        onOpenChange={setIsVoidOpen}
      />

      <ConfirmDialog
        isOpen={isVoidCreditNoteOpen}
        title="Huỷ credit note"
        description="Credit note đã huỷ sẽ không còn giảm công nợ của hoá đơn."
        confirmLabel="Huỷ credit note"
        isConfirming={isVoidingCreditNote}
        onConfirm={handleOnVoidCreditNote}
        onOpenChange={setIsVoidCreditNoteOpen}
      />
    </EntityDrawer>
  );
}
