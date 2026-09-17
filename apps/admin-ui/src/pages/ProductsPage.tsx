import ProductForm from '@components/ProductForm';
import ProductItem from '@components/ProductItem';
import { PAGE_LIMIT } from '@constants/pagination';
import type { ProductFormData } from '@forms/product-form';
import {
  productFormDataToPayload,
  productFormDefaultValues,
  productFormResolver,
} from '@forms/product-form';
import { useCreateProductMutation, useProductsQuery } from '@pinstripe/sdk/react';
import { map } from 'lodash-es';
import { useForm } from 'react-hook-form';

export default function ProductsPage() {
  const {
    data: products,
    isPending,
    error,
  } = useProductsQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { mutateAsync: createProduct, isPending: isSaving } = useCreateProductMutation({
    successMessage: 'Đã tạo product.',
  });
  const form = useForm<ProductFormData>({
    resolver: productFormResolver,
    defaultValues: productFormDefaultValues,
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createProduct(productFormDataToPayload(formData));
    form.reset(productFormDefaultValues);
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>

      <ProductForm form={form} isSaving={isSaving} onSave={handleOnSave} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Mô tả</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {map(products?.data, (product) => {
              return <ProductItem key={product.id} product={product} />;
            })}
          </tbody>
        </table>
        {isPending ? <p className="px-4 py-3 text-slate-500">Đang tải…</p> : null}
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>
    </div>
  );
}
