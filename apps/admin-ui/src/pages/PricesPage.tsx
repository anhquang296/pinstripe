import PageCard from '@components/PageCard';
import PriceForm from '@components/PriceForm';
import PriceItem from '@components/PriceItem';
import type { PriceFormData } from '@forms/price-form';
import {
  priceFormDataToPayload,
  priceFormDefaultValues,
  priceFormResolver,
} from '@forms/price-form';
import { MeterStatusEnum } from '@pinstripe/core/contracts';
import {
  useCreatePriceMutation,
  useMetersQuery,
  usePricesQuery,
  useProductsQuery,
  useUpdatePriceMutation,
} from '@pinstripe/sdk/react';
import { filter, map } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';

const PAGE_LIMIT = 50;
const OPTION_LIMIT = 100;

export default function PricesPage() {
  const {
    data: prices,
    isPending,
    error,
  } = usePricesQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { data: products } = useProductsQuery({ limit: OPTION_LIMIT });
  const { data: meters } = useMetersQuery({ limit: OPTION_LIMIT, status: MeterStatusEnum.ACTIVE });
  const { mutateAsync: createPrice, isPending: isSaving } = useCreatePriceMutation({
    successMessage: 'Đã tạo price.',
  });
  const { mutate: updatePrice } = useUpdatePriceMutation({
    successMessage: 'Đã cập nhật price.',
  });

  const form = useForm<PriceFormData>({
    resolver: priceFormResolver,
    defaultValues: priceFormDefaultValues,
  });

  const productOptions = useMemo(() => {
    const activeProducts = filter(products?.data, 'active');

    return [
      { value: '', label: '— chọn product —' },
      ...map(activeProducts, (product) => {
        return { value: product.id, label: `${product.name} (${product.id})` };
      }),
    ];
  }, [products]);

  const meterOptions = useMemo(() => {
    return [
      { value: '', label: '— chọn meter —' },
      ...map(meters?.data, (meter) => {
        return { value: meter.id, label: `${meter.displayName} (${meter.eventName})` };
      }),
    ];
  }, [meters]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createPrice(priceFormDataToPayload(formData));
    form.reset(priceFormDefaultValues);
  });

  const handleOnToggleActive = useCallback(
    (priceId: string, active: boolean) => {
      updatePrice({ id: priceId, payload: { active } });
    },
    [updatePrice],
  );

  return (
    <PageCard
      title="Prices"
      description="Giá là bất biến: đổi giá sinh version mới, version cũ vẫn phục vụ hợp đồng cũ. Tăng giá là tạo price mới cùng lookup key; ngừng bán là tắt active, không phải xóa."
    >
      <PriceForm
        form={form}
        productOptions={productOptions}
        meterOptions={meterOptions}
        isSaving={isSaving}
        onSave={handleOnSave}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Lookup key</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Giá</th>
              <th className="px-4 py-3">Chu kỳ</th>
              <th className="px-4 py-3">Hiệu lực từ</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {map(prices?.data, (price) => {
              return (
                <PriceItem key={price.id} price={price} onToggleActive={handleOnToggleActive} />
              );
            })}
          </tbody>
        </table>
        {isPending ? <p className="text-app-description px-4 py-3">Đang tải…</p> : null}
        {error ? <p className="px-4 py-3 text-danger">{error.message}</p> : null}
      </div>
    </PageCard>
  );
}
