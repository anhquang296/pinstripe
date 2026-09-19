import CustomerForm from '@components/CustomerForm';
import DataTable from '@components/DataTable';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import PageCard from '@components/PageCard';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import { PAGE_LIMIT } from '@constants/pagination';
import type { CustomerFormData } from '@forms/customer-form';
import {
  customerFormDataToPayload,
  customerFormDefaultValues,
  customerFormResolver,
} from '@forms/customer-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatCurrency, formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { CustomerResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, TaxExemptEnum } from '@pinstripe/core/contracts';
import { useCreateCustomerMutation, useCustomersQuery } from '@pinstripe/sdk/react';
import { filter, get, last, size, toUpper } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import CustomerDrawer from './CustomerDrawer';

export default function CustomersPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [searchEmail, setSearchEmail] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.CUSTOMER_WRITE);

  const { data: customers, isPending } = useCustomersQuery(
    { limit: PAGE_LIMIT, startingAfter, email: searchEmail || undefined },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createCustomer, isPending: isSaving } = useCreateCustomerMutation({
    successMessage: 'Đã tạo customer.',
  });

  const form = useForm<CustomerFormData>({
    resolver: customerFormResolver,
    defaultValues: customerFormDefaultValues,
  });

  const rows = get(customers, 'data', []);
  const hasMore = get(customers, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createCustomer(customerFormDataToPayload(formData));
    form.reset(customerFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnSearchChange = (nextSearchEmail: string) => {
    setSearchEmail(nextSearchEmail);
    resetPage();
  };

  const handleOnNext = () => {
    const lastCustomer = last(rows);

    if (lastCustomer) {
      advancePage(lastCustomer.id);
    }
  };

  const handleOnRowAction = (customer: CustomerResponse) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleOnCloseDetail = () => {
    navigate('/customers');
  };

  return (
    <PageCard
      title="Customers"
      description="Khách hàng, số dư và thông tin thanh toán."
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo customer
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Customer trang này" value={size(rows)} />
        <StatItem label="Có email" value={size(filter(rows, 'email'))} />
        <StatItem
          label="Số dư khác 0"
          value={size(
            filter(rows, (customer) => {
              return customer.balance !== 0;
            }),
          )}
        />
        <StatItem
          label="Miễn hoặc đảo thuế"
          value={size(
            filter(rows, (customer) => {
              return customer.taxExempt !== TaxExemptEnum.NONE;
            }),
          )}
        />
      </StatGrid>

      <DataTable
        toolbar={
          <FilterBar
            itemCount={size(rows)}
            searchValue={searchEmail}
            searchPlaceholder="Tìm theo email"
            onSearchChange={handleOnSearchChange}
          />
        }
        label="Danh sách customer"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        onRowAction={handleOnRowAction}
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'name',
            label: 'Khách hàng',
            isRowHeader: true,
            renderCell: (customer) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{customer.name || '—'}</span>
                  <span className="text-app-label font-mono text-[11px]">{customer.id}</span>
                </div>
              );
            },
          },
          {
            key: 'email',
            label: 'Email',
            renderCell: (customer) => {
              return customer.email ?? '—';
            },
          },
          {
            key: 'balance',
            label: 'Số dư',
            renderCell: (customer) => {
              return formatCurrency(customer.balance, customer.currency);
            },
          },
          {
            key: 'currency',
            label: 'Tiền tệ',
            renderCell: (customer) => {
              return toUpper(customer.currency);
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (customer) => {
              return formatDate(customer.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo customer"
        description="Một khách hàng mới trên bề mặt billing."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin khách hàng">
          <CustomerForm mode="create" form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {customerId ? <CustomerDrawer customerId={customerId} onClose={handleOnCloseDetail} /> : null}
    </PageCard>
  );
}
