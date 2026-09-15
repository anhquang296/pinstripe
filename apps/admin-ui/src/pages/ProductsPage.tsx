import ProductItem from '@components/ProductItem';
import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import type { CreateProductFormValues } from '@forms/create-product-form';
import {
  createProductFormDefaultValues,
  createProductFormSchema,
} from '@forms/create-product-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateProductMutation, useProductsQuery } from '@reactquery/products';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

const PAGE_LIMIT = 20;

export default function ProductsPage() {
  const {
    data: products,
    isPending,
    error,
  } = useProductsQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const { mutateAsync: createProduct } = useCreateProductMutation();
  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductFormSchema),
    defaultValues: createProductFormDefaultValues,
  });

  const handleOnSubmit = useCallback(
    async (values: CreateProductFormValues) => {
      await createProduct({
        name: values.name,
        description: values.description || undefined,
        unitLabel: values.unitLabel || undefined,
      });

      form.reset(createProductFormDefaultValues);
    },
    [createProduct, form],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>

      <form
        className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={form.handleSubmit(handleOnSubmit)}
      >
        <TextField
          label="Tên"
          placeholder="Pinstripe Pro"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="Mô tả"
          placeholder="Gói dành cho doanh nghiệp"
          {...form.register('description')}
        />
        <TextField label="Đơn vị" placeholder="seat" {...form.register('unitLabel')} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Tạo product
        </Button>
      </form>

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
            {products?.data.map((product) => {
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
