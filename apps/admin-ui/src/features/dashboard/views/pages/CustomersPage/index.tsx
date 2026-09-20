import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import PageCard from '@common/components/PageCard';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import { PAGE_LIMIT } from '@common/constants/pagination';
import { SEARCH_DEBOUNCE_MS } from '@common/constants/time';
import type { CustomerFormData } from '@common/forms/customer-form';
import {
  customerFormDataToPayload,
  customerFormDefaultValues,
  customerFormResolver,
} from '@common/forms/customer-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { useSearchPreservingNavigate } from '@common/hooks/useSearchPreservingNavigate';
import { formatCurrency, formatDate } from '@common/utils/format';
import { toQuery } from '@common/utils/search-params';
import CustomerForm from '@features/dashboard/components/CustomerForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { CustomerResponse } from '@pinstripe/core/contracts';
import { PermissionEnum, TaxExemptEnum } from '@pinstripe/core/contracts';
import { useCreateCustomerMutation, useCustomersQuery } from '@pinstripe/sdk/react';
import { filter, get, isEmpty, last, size, toUpper } from 'lodash-es';
import { debounce, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import CustomerDrawer from './CustomerDrawer';
import { customerSearchParams } from './customers.search-params';

export default function CustomersPage() {
  const { customerId } = useParams();

  const navigate = useSearchPreservingNavigate();

  const [search, setSearch] = useQueryStates(customerSearchParams);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { hasPrevious, advancePage, revertPage } = useCursorPagination({
    after: search.after,
    onPageChange: (after) => {
      setSearch({ after });
    },
  });

  const canWrite = useCan(PermissionEnum.CUSTOMER_WRITE);

  const { data: customers, isPending } = useCustomersQuery(
    { limit: PAGE_LIMIT, ...toQuery(search) },
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

  const handleOnEmailChange = (email: string) => {
    setSearch(
      { email: isEmpty(email) ? null : email, after: null },
      { limitUrlUpdates: isEmpty(email) ? undefined : debounce(SEARCH_DEBOUNCE_MS) },
    );
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
            searchValue={search.email}
            searchPlaceholder="Tìm theo email"
            onSearchChange={handleOnEmailChange}
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
