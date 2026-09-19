import BalanceTransactionForm from '@components/BalanceTransactionForm';
import ConfirmDialog from '@components/ConfirmDialog';
import CustomerForm from '@components/CustomerForm';
import DataTable from '@components/DataTable';
import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import DrawerTabs from '@components/DrawerTabs';
import EntityDrawer from '@components/EntityDrawer';
import StatusChip from '@components/StatusChip';
import TaxIdForm from '@components/TaxIdForm';
import { PAGE_LIMIT } from '@constants/pagination';
import type { BalanceTransactionFormData } from '@forms/balance-transaction-form';
import {
  balanceTransactionFormDataToPayload,
  balanceTransactionFormDefaultValues,
  balanceTransactionFormResolver,
} from '@forms/balance-transaction-form';
import type { CustomerFormData } from '@forms/customer-form';
import {
  customerFormDataToUpdatePayload,
  customerFormDefaultValues,
  customerFormResolver,
  customerToFormData,
} from '@forms/customer-form';
import type { TaxIdFormData } from '@forms/tax-id-form';
import {
  taxIdFormDataToPayload,
  taxIdFormDefaultValues,
  taxIdFormResolver,
} from '@forms/tax-id-form';
import { Button } from '@heroui/react';
import { formatCurrency, formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { CurrencyEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useBillingPortalSessionQuery,
  useCreateBillingPortalSessionMutation,
  useCreateCustomerBalanceTransactionMutation,
  useCreatePortalLinkMutation,
  useCreateTaxIdMutation,
  useCustomerBalanceTransactionsQuery,
  useCustomerQuery,
  useDeleteCustomerMutation,
  useDeleteTaxIdMutation,
  useInvoicesQuery,
  useSubscriptionsQuery,
  useTaxIdQuery,
  useTaxIdsQuery,
  useUpdateCustomerMutation,
} from '@pinstripe/sdk/react';
import { get, toUpper } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

const DETAIL_TAB = 'detail';
const BALANCE_TAB = 'balance';
const TAX_ID_TAB = 'tax_id';
const SUBSCRIPTION_TAB = 'subscription';
const INVOICE_TAB = 'invoice';

const TABS = [
  { key: DETAIL_TAB, label: 'Chi tiết' },
  { key: BALANCE_TAB, label: 'Balance transactions' },
  { key: TAX_ID_TAB, label: 'Tax IDs' },
  { key: SUBSCRIPTION_TAB, label: 'Subscriptions' },
  { key: INVOICE_TAB, label: 'Invoices' },
];

interface CustomerDrawerProps {
  customerId: string;
  onClose: () => void;
}

export default function CustomerDrawer({ customerId, onClose }: CustomerDrawerProps) {
  const [activeTab, setActiveTab] = useState(DETAIL_TAB);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTaxIdId, setSelectedTaxIdId] = useState('');
  const [portalSessionId, setPortalSessionId] = useState('');

  const canWrite = useCan(PermissionEnum.CUSTOMER_WRITE);
  const canDelete = useCan(PermissionEnum.CUSTOMER_DELETE);
  const canWriteCatalog = useCan(PermissionEnum.CATALOG_WRITE);
  const canWriteSubscription = useCan(PermissionEnum.SUBSCRIPTION_WRITE);

  const { data: customer } = useCustomerQuery(customerId);
  const { data: balanceTransactions } = useCustomerBalanceTransactionsQuery(
    customerId,
    { limit: PAGE_LIMIT },
    { enabled: activeTab === BALANCE_TAB },
  );
  const { data: taxIds } = useTaxIdsQuery(
    { customerId, limit: PAGE_LIMIT },
    { enabled: activeTab === TAX_ID_TAB },
  );
  const { data: taxId } = useTaxIdQuery(selectedTaxIdId, { enabled: Boolean(selectedTaxIdId) });
  const { data: subscriptions } = useSubscriptionsQuery(
    { customerId, limit: PAGE_LIMIT },
    { enabled: activeTab === SUBSCRIPTION_TAB },
  );
  const { data: invoices } = useInvoicesQuery(
    { customerId, limit: PAGE_LIMIT },
    { enabled: activeTab === INVOICE_TAB },
  );
  const { data: portalSession } = useBillingPortalSessionQuery(portalSessionId, {
    enabled: Boolean(portalSessionId),
  });

  const { mutateAsync: updateCustomer, isPending: isSaving } = useUpdateCustomerMutation({
    successMessage: 'Đã cập nhật customer.',
  });
  const { mutateAsync: deleteCustomer, isPending: isDeleting } = useDeleteCustomerMutation({
    successMessage: 'Đã xoá customer.',
  });
  const { mutateAsync: createBalanceTransaction, isPending: isCrediting } =
    useCreateCustomerBalanceTransactionMutation({ successMessage: 'Đã ghi bút toán số dư.' });
  const { mutateAsync: createTaxId, isPending: isAddingTaxId } = useCreateTaxIdMutation({
    successMessage: 'Đã thêm mã số thuế.',
  });
  const { mutate: deleteTaxId } = useDeleteTaxIdMutation({ successMessage: 'Đã xoá mã số thuế.' });
  const { mutate: createPortalLink } = useCreatePortalLinkMutation({
    successMessage: 'Đã gửi link portal cho khách.',
  });
  const { mutateAsync: createBillingPortalSession } = useCreateBillingPortalSessionMutation();

  const customerForm = useForm<CustomerFormData>({
    resolver: customerFormResolver,
    defaultValues: customerFormDefaultValues,
  });
  const balanceForm = useForm<BalanceTransactionFormData>({
    resolver: balanceTransactionFormResolver,
    defaultValues: balanceTransactionFormDefaultValues,
  });
  const taxIdForm = useForm<TaxIdFormData>({
    resolver: taxIdFormResolver,
    defaultValues: taxIdFormDefaultValues,
  });

  useEffect(() => {
    if (customer) {
      customerForm.reset(customerToFormData(customer));
    }
  }, [customer, customerForm]);

  const currency = get(customer, 'currency', CurrencyEnum.VND);

  const handleOnSave = customerForm.handleSubmit(async (formData) => {
    await updateCustomer({ id: customerId, payload: customerFormDataToUpdatePayload(formData) });
  });

  const handleOnCredit = balanceForm.handleSubmit(async (formData) => {
    await createBalanceTransaction({
      id: customerId,
      payload: balanceTransactionFormDataToPayload(currency, formData),
    });
    balanceForm.reset(balanceTransactionFormDefaultValues);
  });

  const handleOnAddTaxId = taxIdForm.handleSubmit(async (formData) => {
    await createTaxId(taxIdFormDataToPayload(customerId, formData));
    taxIdForm.reset(taxIdFormDefaultValues);
  });

  const handleOnDelete = async () => {
    await deleteCustomer(customerId);
    setIsDeleteOpen(false);
    onClose();
  };

  const handleOnCreatePortalLink = () => {
    const email = get(customer, 'email');

    if (email) {
      createPortalLink({ email });
    }
  };

  const handleOnOpenBillingPortal = async () => {
    const session = await createBillingPortalSession({ customerId });

    setPortalSessionId(session.id);
  };

  return (
    <EntityDrawer
      isOpen
      title={get(customer, 'name') || customerId}
      description={get(customer, 'email') ?? customerId}
      tabs={<DrawerTabs items={TABS} activeKey={activeTab} onSelect={setActiveTab} />}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Đóng
          </Button>
          {canDelete ? (
            <Button
              variant="danger"
              onPress={() => {
                setIsDeleteOpen(true);
              }}
            >
              Xoá customer
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
                { label: 'ID', value: customerId },
                { label: 'Tiền tệ', value: toUpper(currency) },
                { label: 'Số dư', value: formatCurrency(get(customer, 'balance', 0), currency) },
                { label: 'Miễn thuế', value: get(customer, 'taxExempt', '—') },
                { label: 'Tạo lúc', value: formatDate(get(customer, 'createdAt', '')) },
                { label: 'Điện thoại', value: get(customer, 'phone') || '—' },
              ]}
            />
          </DrawerSection>

          {canWrite ? (
            <DrawerSection title="Sửa thông tin">
              <CustomerForm
                mode="edit"
                form={customerForm}
                isSaving={isSaving}
                onSave={handleOnSave}
              />
            </DrawerSection>
          ) : null}

          {canWriteSubscription ? (
            <DrawerSection title="Portal">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" onPress={handleOnCreatePortalLink}>
                  Tạo link portal
                </Button>
                <Button variant="ghost" onPress={handleOnOpenBillingPortal}>
                  Mở billing portal
                </Button>
                {portalSession ? (
                  <span className="text-app-label text-[12px]">
                    {portalSession.url} · hết hạn {formatDate(portalSession.expiresAt)}
                  </span>
                ) : null}
              </div>
            </DrawerSection>
          ) : null}
        </div>
      ) : null}

      {activeTab === BALANCE_TAB ? (
        <div className="flex flex-col gap-4">
          {canWrite ? (
            <DrawerSection title="Ghi bút toán số dư">
              <BalanceTransactionForm
                form={balanceForm}
                isSaving={isCrediting}
                onSave={handleOnCredit}
              />
            </DrawerSection>
          ) : null}

          <DataTable
            label="Balance transactions"
            rows={get(balanceTransactions, 'data', [])}
            emptyMessage="Khách này chưa có bút toán số dư."
            columns={[
              {
                key: 'type',
                label: 'Loại',
                isRowHeader: true,
                renderCell: (balanceTransaction) => {
                  return balanceTransaction.type;
                },
              },
              {
                key: 'amount',
                label: 'Số tiền',
                renderCell: (balanceTransaction) => {
                  return formatCurrency(balanceTransaction.amount, balanceTransaction.currency);
                },
              },
              {
                key: 'endingBalance',
                label: 'Số dư sau',
                renderCell: (balanceTransaction) => {
                  return formatCurrency(
                    balanceTransaction.endingBalance,
                    balanceTransaction.currency,
                  );
                },
              },
              {
                key: 'description',
                label: 'Diễn giải',
                renderCell: (balanceTransaction) => {
                  return balanceTransaction.description || '—';
                },
              },
              {
                key: 'createdAt',
                label: 'Tạo lúc',
                renderCell: (balanceTransaction) => {
                  return formatDate(balanceTransaction.createdAt);
                },
              },
            ]}
          />
        </div>
      ) : null}

      {activeTab === TAX_ID_TAB ? (
        <div className="flex flex-col gap-4">
          {canWriteCatalog ? (
            <DrawerSection title="Thêm mã số thuế">
              <TaxIdForm form={taxIdForm} isSaving={isAddingTaxId} onSave={handleOnAddTaxId} />
            </DrawerSection>
          ) : null}

          <DataTable
            label="Tax IDs"
            rows={get(taxIds, 'data', [])}
            emptyMessage="Khách này chưa khai mã số thuế."
            onRowAction={(row) => {
              setSelectedTaxIdId(row.id);
            }}
            columns={[
              {
                key: 'value',
                label: 'Mã số thuế',
                isRowHeader: true,
                renderCell: (row) => {
                  return row.value;
                },
              },
              {
                key: 'type',
                label: 'Loại',
                renderCell: (row) => {
                  return row.type;
                },
              },
              {
                key: 'verification',
                label: 'Xác minh',
                renderCell: (row) => {
                  return <StatusChip status={row.verification.status} />;
                },
              },
              {
                key: 'actions',
                label: 'Thao tác',
                renderCell: (row) => {
                  if (!canWriteCatalog) {
                    return null;
                  }

                  return (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        deleteTaxId(row.id);
                      }}
                    >
                      Xoá
                    </Button>
                  );
                },
              },
            ]}
          />

          {taxId ? (
            <DrawerSection title={`Chi tiết ${taxId.value}`}>
              <DetailList
                items={[
                  { label: 'ID', value: taxId.id },
                  { label: 'Quốc gia', value: taxId.country ?? '—' },
                  { label: 'Trạng thái', value: taxId.verification.status },
                  { label: 'Tên đã xác minh', value: taxId.verification.verifiedName ?? '—' },
                ]}
              />
            </DrawerSection>
          ) : null}
        </div>
      ) : null}

      {activeTab === SUBSCRIPTION_TAB ? (
        <DataTable
          label="Subscriptions của khách"
          rows={get(subscriptions, 'data', [])}
          emptyMessage="Khách này chưa có thuê bao."
          columns={[
            {
              key: 'id',
              label: 'Subscription',
              isRowHeader: true,
              renderCell: (subscription) => {
                return subscription.id;
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (subscription) => {
                return <StatusChip status={subscription.status} />;
              },
            },
            {
              key: 'currentPeriodEnd',
              label: 'Hết kỳ',
              renderCell: (subscription) => {
                return formatDate(subscription.currentPeriodEnd);
              },
            },
          ]}
        />
      ) : null}

      {activeTab === INVOICE_TAB ? (
        <DataTable
          label="Invoices của khách"
          rows={get(invoices, 'data', [])}
          emptyMessage="Khách này chưa có hoá đơn."
          columns={[
            {
              key: 'number',
              label: 'Số hoá đơn',
              isRowHeader: true,
              renderCell: (invoice) => {
                return invoice.number || invoice.id;
              },
            },
            {
              key: 'status',
              label: 'Trạng thái',
              renderCell: (invoice) => {
                return <StatusChip status={invoice.status} />;
              },
            },
            {
              key: 'total',
              label: 'Tổng',
              renderCell: (invoice) => {
                return formatCurrency(invoice.total, invoice.currency);
              },
            },
            {
              key: 'createdAt',
              label: 'Tạo lúc',
              renderCell: (invoice) => {
                return formatDate(invoice.createdAt);
              },
            },
          ]}
        />
      ) : null}

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Xoá customer"
        description="Customer bị xoá sẽ không còn dùng được cho hoá đơn mới. Thao tác này không đảo lại được."
        confirmLabel="Xoá"
        isConfirming={isDeleting}
        onConfirm={handleOnDelete}
        onOpenChange={setIsDeleteOpen}
      />
    </EntityDrawer>
  );
}
