import SubscriptionForm from '@components/SubscriptionForm';
import SubscriptionItem from '@components/SubscriptionItem';
import { OPTION_LIMIT, PAGE_LIMIT } from '@constants/pagination';
import type { SubscriptionFormData } from '@forms/subscription-form';
import {
  subscriptionFormDataToPayload,
  subscriptionFormDefaultValues,
  subscriptionFormResolver,
} from '@forms/subscription-form';
import { formatPriceAmount } from '@lib/price';
import {
  useCancelSubscriptionMutation,
  useCreateSubscriptionMutation,
  useCustomersQuery,
  useEntitlementsQuery,
  usePricesQuery,
  useSubscriptionsQuery,
} from '@pinstripe/sdk/react';
import { filter, map, toUpper } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';

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
  const { mutateAsync: createSubscription, isPending: isSaving } = useCreateSubscriptionMutation({
    successMessage: 'Đã tạo subscription.',
  });
  const { mutate: cancelSubscription } = useCancelSubscriptionMutation({
    successMessage: 'Đã hủy subscription.',
  });

  const form = useForm<SubscriptionFormData>({
    resolver: subscriptionFormResolver,
    defaultValues: subscriptionFormDefaultValues,
  });

  const customerOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn khách hàng —' },
      ...map(customers?.data, (customer) => {
        return {
          value: customer.id,
          label: `${customer.name || customer.email || customer.id} (${toUpper(customer.currency)})`,
        };
      }),
    ];
  }, [customers]);

  const priceOptions = useMemo(() => {
    const recurringPrices = filter(prices?.data, { type: 'recurring' });

    return [
      { value: '', label: '— chọn bảng giá —' },
      ...map(recurringPrices, (price) => {
        const { id, lookupKey, version } = price;
        const priceName = lookupKey === null ? id : lookupKey;

        return {
          value: id,
          label: `${priceName} · v${version} · ${formatPriceAmount(price)}`,
        };
      }),
    ];
  }, [prices]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createSubscription(subscriptionFormDataToPayload(formData));
    form.reset(subscriptionFormDefaultValues);
  });

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

      <SubscriptionForm
        form={form}
        customerOptions={customerOptions}
        priceOptions={priceOptions}
        isSaving={isSaving}
        onSave={handleOnSave}
      />

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
            {map(subscriptions?.data, (subscription) => {
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
              {map(entitlements?.data, (entitlement) => {
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
