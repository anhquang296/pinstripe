import CustomerForm from '@components/CustomerForm';
import CustomerItem from '@components/CustomerItem';
import type { CustomerFormData } from '@forms/customer-form';
import {
  customerFormDataToPayload,
  customerFormDefaultValues,
  customerFormResolver,
} from '@forms/customer-form';
import { useCreateCustomerMutation, useCustomersQuery } from '@reactquery/customers';
import { useForm } from 'react-hook-form';

const PAGE_LIMIT = 20;

export default function CustomersPage() {
  const {
    data: customers,
    isPending,
    error,
  } = useCustomersQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { mutateAsync: createCustomer, isPending: isSaving } = useCreateCustomerMutation();
  const form = useForm<CustomerFormData>({
    resolver: customerFormResolver,
    defaultValues: customerFormDefaultValues,
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createCustomer(customerFormDataToPayload(formData));
    form.reset(customerFormDefaultValues);
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>

      <CustomerForm form={form} isSaving={isSaving} onSave={handleOnSave} />

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
            {customers?.data.map((customer) => {
              return <CustomerItem key={customer.id} customer={customer} />;
            })}
          </tbody>
        </table>
        {isPending ? <p className="px-4 py-3 text-slate-500">Đang tải…</p> : null}
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>
    </div>
  );
}
