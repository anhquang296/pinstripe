import DataTable from '@common/components/DataTable';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import FilterBar from '@common/components/FilterBar';
import FilterSelect from '@common/components/FilterSelect';
import PageCard from '@common/components/PageCard';
import PageTabs from '@common/components/PageTabs';
import StatGrid from '@common/components/StatGrid';
import StatItem from '@common/components/StatItem';
import StatusChip from '@common/components/StatusChip';
import { PAGE_LIMIT } from '@common/constants/pagination';
import type { ProductFormData } from '@common/forms/product-form';
import {
  productFormDataToPayload,
  productFormDefaultValues,
  productFormResolver,
} from '@common/forms/product-form';
import { useCursorPagination } from '@common/hooks/useCursorPagination';
import { formatDate } from '@common/utils/format';
import ProductForm from '@features/dashboard/components/ProductForm';
import { CATALOG_TABS } from '@features/dashboard/constants/tabs';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import type { ProductResponse } from '@pinstripe/core/contracts';
import { PermissionEnum } from '@pinstripe/core/contracts';
import { useCreateProductMutation, useProductsQuery } from '@pinstripe/sdk/react';
import { filter, get, last, reject, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import ProductDrawer from './ProductDrawer';

const ACTIVE_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
];

export default function ProductsPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { startingAfter, hasPrevious, advancePage, revertPage, resetPage } = useCursorPagination();
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: products, isPending } = useProductsQuery(
    {
      limit: PAGE_LIMIT,
      startingAfter,
      active: activeFilter === 'all' ? undefined : activeFilter === 'active',
    },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createProduct, isPending: isSaving } = useCreateProductMutation({
    successMessage: 'Đã tạo product.',
  });

  const form = useForm<ProductFormData>({
    resolver: productFormResolver,
    defaultValues: productFormDefaultValues,
  });

  const rows = get(products, 'data', []);
  const hasMore = get(products, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createProduct(productFormDataToPayload(formData));
    form.reset(productFormDefaultValues);
    setIsCreateOpen(false);
  });

  const handleOnFilterSelect = (nextActiveFilter: string) => {
    setActiveFilter(nextActiveFilter);
    resetPage();
  };

  const handleOnNext = () => {
    const lastProduct = last(rows);

    if (lastProduct) {
      advancePage(lastProduct.id);
    }
  };

  const handleOnRowAction = (product: ProductResponse) => {
    navigate(`/catalog/products/${product.id}`);
  };

  return (
    <PageCard
      title="Products & Prices"
      description="Danh mục sản phẩm; mỗi product gắn nhiều version của bảng giá."
      tabs={<PageTabs items={CATALOG_TABS} />}
      actions={
        canWrite ? (
          <Button
            onPress={() => {
              setIsCreateOpen(true);
            }}
          >
            Tạo product
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Product trang này" value={size(rows)} />
        <StatItem label="Đang bán" value={size(filter(rows, 'active'))} />
        <StatItem label="Ngừng bán" value={size(reject(rows, 'active'))} />
        <StatItem label="Có đơn vị tính" value={size(filter(rows, 'unitLabel'))} />
      </StatGrid>

      <DataTable
        toolbar={
          <FilterBar itemCount={size(rows)}>
            <FilterSelect
              label="Trạng thái"
              options={ACTIVE_OPTIONS}
              selectedValue={activeFilter}
              onSelect={handleOnFilterSelect}
            />
          </FilterBar>
        }
        label="Danh sách product"
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
            label: 'Product',
            isRowHeader: true,
            renderCell: (product) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-app-label font-mono text-[11px]">{product.id}</span>
                </div>
              );
            },
          },
          {
            key: 'description',
            label: 'Mô tả',
            renderCell: (product) => {
              return product.description || '—';
            },
          },
          {
            key: 'unitLabel',
            label: 'Đơn vị',
            renderCell: (product) => {
              return product.unitLabel || '—';
            },
          },
          {
            key: 'active',
            label: 'Trạng thái',
            renderCell: (product) => {
              return <StatusChip status={product.active ? 'active' : 'inactive'} />;
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (product) => {
              return formatDate(product.createdAt);
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo product"
        description="Product là thứ được bán; giá nằm ở price."
        onOpenChange={setIsCreateOpen}
      >
        <DrawerSection title="Thông tin product">
          <ProductForm mode="create" form={form} isSaving={isSaving} onSave={handleOnSave} />
        </DrawerSection>
      </EntityDrawer>

      {productId ? (
        <ProductDrawer
          productId={productId}
          onClose={() => {
            navigate('/catalog/products');
          }}
        />
      ) : null}
    </PageCard>
  );
}
