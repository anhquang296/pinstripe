import SubscriptionItem from '@components/SubscriptionItem';
import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { CreateSubscriptionFormValues } from '@forms/create-subscription-form';
import {
  createSubscriptionFormDefaultValues,
  createSubscriptionFormSchema,
} from '@forms/create-subscription-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCustomersQuery } from '@reactquery/customers';
import { useEntitlementsQuery } from '@reactquery/entitlements';
import { usePricesQuery } from '@reactquery/prices';
import {
  useCancelSubscriptionMutation,
  useCreateSubscriptionMutation,
  useSubscriptionsQuery,
} from '@reactquery/subscriptions';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';

const PAGE_LIMIT = 20;
const OPTION_LIMIT = 100;

export default function SubscriptionsPage() {
  const { data: subscriptions, error: subscriptionsError } = useSubscriptionsQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { data: customers } = useCustomersQuery({ limit: OPTION_LIMIT });
  const { data: prices } = usePricesQuery({ limit: OPTION_LIMIT, active: true });
  const { data: entitlements } = useEntitlementsQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { mutateAsync: createSubscription } = useCreateSubscriptionMutation();
  const { mutate: cancelSubscription } = useCancelSubscriptionMutation();

  const form = useForm<CreateSubscriptionFormValues>({
    resolver: zodResolver(createSubscriptionFormSchema),
    defaultValues: createSubscriptionFormDefaultValues,
  });

  const customerOptions = useMemo(() => {
    const customerOptionSource = customers?.data ?? [];

    return [
      { value: '', label: '— chọn khách hàng —' },
      ...customerOptionSource.map((customer) => {
        return {
          value: customer.id,
          label: `${customer.name || customer.email || customer.id} (${customer.currency.toUpperCase()})`,
        };
      }),
    ];
  }, [customers]);

  const priceOptions = useMemo(() => {
    const priceOptionSource = (prices?.data ?? []).filter((price) => {
      return price.type === 'recurring';
    });

    return [
      { value: '', label: '— chọn bảng giá —' },
      ...priceOptionSource.map((price) => {
        return {
          value: price.id,
          label: `${price.lookupKey ?? price.id} · ${price.billingScheme} · ${price.currency.toUpperCase()}`,
        };
      }),
    ];
  }, [prices]);

  const handleOnSubmit = useCallback(
    async (values: CreateSubscriptionFormValues) => {
      await createSubscription({
        customerId: values.customerId,
        items: [{ priceId: values.priceId }],
        trialPeriodDays: values.trialPeriodDays > 0 ? values.trialPeriodDays : undefined,
      });

      form.reset(createSubscriptionFormDefaultValues);
    },
    [createSubscription, form],
  );

  const handleOnCancel = useCallback(
    (subscriptionId: string, cancelAtPeriodEnd: boolean) => {
      cancelSubscription({ id: subscriptionId, payload: { cancelAtPeriodEnd } });
    },
    [cancelSubscription],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-slate-500">
          Quyền dùng tách khỏi chu kỳ tính tiền: hủy cuối kỳ thì khách vẫn dùng tới hết kỳ.
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={form.handleSubmit(handleOnSubmit)}
      >
        <SelectField
          label="Khách hàng"
          options={customerOptions}
          error={form.formState.errors.customerId?.message}
          {...form.register('customerId')}
        />
        <SelectField
          label="Bảng giá"
          options={priceOptions}
          error={form.formState.errors.priceId?.message}
          {...form.register('priceId')}
        />
        <TextField
          label="Trial (ngày)"
          type="number"
          min={0}
          className="w-28"
          {...form.register('trialPeriodDays', { valueAsNumber: true })}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Tạo subscription
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Kỳ hiện tại</th>
              <th className="px-4 py-3">Hết trial</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions?.data.map((subscription) => {
              return (
                <SubscriptionItem
                  key={subscription.id}
                  subscription={subscription}
                  onCancel={handleOnCancel}
                />
              );
            })}
          </tbody>
        </table>
        {subscriptionsError ? (
          <p className="px-4 py-3 text-red-600">{subscriptionsError.message}</p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Entitlements</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {entitlements?.data.map((entitlement) => {
                return (
                  <tr key={entitlement.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {entitlement.customerId}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {entitlement.productId}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {entitlement.subscriptionId}
                    </td>
                    <td className="px-4 py-3">{entitlement.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
