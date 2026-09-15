import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@components/ui/Button';
import CustomerItem from '@components/CustomerItem';
import TextField from '@components/ui/TextField';
import {
  createCustomerFormDefaultValues,
  createCustomerFormSchema,
} from '@forms/create-customer-form';
import type { CreateCustomerFormValues } from '@forms/create-customer-form';
import { useCreateCustomerMutation, useCustomersQuery } from '@reactquery/customers';

const PAGE_LIMIT = 20;

export default function CustomersPage() {
  const { data, isPending, error } = useCustomersQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const createCustomerMutation = useCreateCustomerMutation();
  const form = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerFormSchema),
    defaultValues: createCustomerFormDefaultValues,
  });

  const handleOnSubmit = useCallback(
    async (values: CreateCustomerFormValues) => {
      await createCustomerMutation.mutateAsync(values);

      form.reset(createCustomerFormDefaultValues);
    },
    [createCustomerMutation, form],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>

      <form
        className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={form.handleSubmit(handleOnSubmit)}
      >
        <TextField
          label="Email"
          placeholder="ke.toan@congty.vn"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label="Tên"
          placeholder="Công ty ABC"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Tạo customer
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tiền tệ</th>
              <th className="px-4 py-3">Tạo lúc</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((customer) => (
              <CustomerItem key={customer.id} customer={customer} />
            ))}
          </tbody>
        </table>
        {isPending ? <p className="px-4 py-3 text-slate-500">Đang tải…</p> : null}
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>
    </div>
  );
}
