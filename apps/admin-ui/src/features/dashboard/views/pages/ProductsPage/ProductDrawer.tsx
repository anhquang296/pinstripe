import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import { OPTION_LIMIT, PAGE_LIMIT } from '@common/constants/pagination';
import type { PriceFormData } from '@common/forms/price-form';
import {
  priceFormDataToPayload,
  priceFormDefaultValues,
  priceFormResolver,
} from '@common/forms/price-form';
import type { ProductFormData } from '@common/forms/product-form';
import {
  productFormDataToUpdatePayload,
  productFormDefaultValues,
  productFormResolver,
  productToFormData,
} from '@common/forms/product-form';
import { formatDate } from '@common/utils/format';
import { formatPriceAmount } from '@common/utils/price';
import PriceForm from '@features/dashboard/components/PriceForm';
import ProductForm from '@features/dashboard/components/ProductForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { MeterStatusEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useCreatePriceMutation,
  useMetersQuery,
  usePricesQuery,
  useProductQuery,
  useUpdateProductMutation,
} from '@pinstripe/sdk/react';
import { get, map } from 'lodash-es';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface ProductDrawerProps {
  productId: string;
  onClose: () => void;
}

export default function ProductDrawer({ productId, onClose }: ProductDrawerProps) {
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: product } = useProductQuery(productId);
  const { data: prices } = usePricesQuery({ productId, limit: PAGE_LIMIT });
  const { data: meters } = useMetersQuery({ limit: OPTION_LIMIT, status: MeterStatusEnum.ACTIVE });

  const { mutateAsync: updateProduct, isPending: isSaving } = useUpdateProductMutation({
    successMessage: 'Đã cập nhật product.',
  });
  const { mutateAsync: createPrice, isPending: isCreatingPrice } = useCreatePriceMutation({
    successMessage: 'Đã tạo price.',
  });

  const productForm = useForm<ProductFormData>({
    resolver: productFormResolver,
    defaultValues: productFormDefaultValues,
  });
  const priceForm = useForm<PriceFormData>({
    resolver: priceFormResolver,
    defaultValues: { ...priceFormDefaultValues, productId },
  });

  useEffect(() => {
    if (product) {
      productForm.reset(productToFormData(product));
    }
  }, [product, productForm]);

  const productOptions = [{ value: productId, label: get(product, 'name', productId) }];
  const meterOptions = map(get(meters, 'data', []), (meter) => {
    return { value: meter.id, label: `${meter.displayName} (${meter.eventName})` };
  });

  const handleOnSave = productForm.handleSubmit(async (formData) => {
    await updateProduct({ id: productId, payload: productFormDataToUpdatePayload(formData) });
  });

  const handleOnToggleActive = async () => {
    await updateProduct({ id: productId, payload: { active: !get(product, 'active', false) } });
  };

  const handleOnCreatePrice = priceForm.handleSubmit(async (formData) => {
    await createPrice(priceFormDataToPayload({ ...formData, productId }));
    priceForm.reset({ ...priceFormDefaultValues, productId });
  });

  return (
    <EntityDrawer
      isOpen
      title={get(product, 'name', productId)}
      description={productId}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Đóng
          </Button>
          {canWrite ? (
            <Button variant="ghost" isDisabled={isSaving} onPress={handleOnToggleActive}>
              {get(product, 'active', false) ? 'Ngừng bán' : 'Mở bán lại'}
            </Button>
          ) : null}
        </>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'ID', value: productId },
              { label: 'Đơn vị', value: get(product, 'unitLabel') || '—' },
              {
                label: 'Trạng thái',
                value: (
                  <StatusChip status={get(product, 'active', false) ? 'active' : 'inactive'} />
                ),
              },
              { label: 'Tạo lúc', value: formatDate(get(product, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Sửa product">
            <ProductForm mode="edit" form={productForm} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}

        <DrawerSection title="Bảng giá của product">
          <DataTable
            label="Prices của product"
            rows={get(prices, 'data', [])}
            emptyMessage="Product này chưa có price nào."
            columns={[
              {
                key: 'lookupKey',
                label: 'Lookup key',
                isRowHeader: true,
                renderCell: (price) => {
                  const { lookupKey } = price;

                  if (lookupKey === null) {
                    return price.id;
                  }

                  return lookupKey;
                },
              },
              {
                key: 'version',
                label: 'Version',
                renderCell: (price) => {
                  return `v${price.version}`;
                },
              },
              {
                key: 'amount',
                label: 'Giá',
                renderCell: (price) => {
                  return formatPriceAmount(price);
                },
              },
              {
                key: 'active',
                label: 'Trạng thái',
                renderCell: (price) => {
                  return <StatusChip status={price.active ? 'active' : 'inactive'} />;
                },
              },
              {
                key: 'effectiveAt',
                label: 'Hiệu lực từ',
                renderCell: (price) => {
                  return formatDate(price.effectiveAt);
                },
              },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Tạo price cho product này">
            <PriceForm
              form={priceForm}
              productOptions={productOptions}
              meterOptions={meterOptions}
              isSaving={isCreatingPrice}
              onSave={handleOnCreatePrice}
            />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
