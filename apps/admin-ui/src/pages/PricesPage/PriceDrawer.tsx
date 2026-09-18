import DataTable from '@components/DataTable';
import DetailList from '@components/DetailList';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import PriceUpdateForm from '@components/PriceUpdateForm';
import StatusChip from '@components/StatusChip';
import type { PriceUpdateFormData } from '@forms/price-update-form';
import {
  priceToUpdateFormData,
  priceUpdateFormDataToPayload,
  priceUpdateFormDefaultValues,
  priceUpdateFormResolver,
} from '@forms/price-update-form';
import { Button } from '@heroui/react';
import { formatCurrency, formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import { formatPriceAmount } from '@lib/price';
import { BillingSchemeEnum, PermissionEnum } from '@pinstripe/core/contracts';
import { usePriceQuery, useUpdatePriceMutation } from '@pinstripe/sdk/react';
import { get, map, toUpper } from 'lodash-es';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface PriceDrawerProps {
  priceId: string;
  onClose: () => void;
}

export default function PriceDrawer({ priceId, onClose }: PriceDrawerProps) {
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: price } = usePriceQuery(priceId);
  const { mutateAsync: updatePrice, isPending: isSaving } = useUpdatePriceMutation({
    successMessage: 'Đã cập nhật price.',
  });

  const form = useForm<PriceUpdateFormData>({
    resolver: priceUpdateFormResolver,
    defaultValues: priceUpdateFormDefaultValues,
  });

  useEffect(() => {
    if (price) {
      form.reset(priceToUpdateFormData(price));
    }
  }, [price, form]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updatePrice({ id: priceId, payload: priceUpdateFormDataToPayload(formData) });
  });

  const tierRows = map(get(price, 'tiers') ?? [], (tier, index) => {
    return { id: `tier-${index}`, ...tier };
  });

  return (
    <EntityDrawer
      isOpen
      title={priceId}
      description={price ? formatPriceAmount(price) : priceId}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Product', value: get(price, 'productId', '—') },
              { label: 'Lookup key', value: get(price, 'lookupKey') || '—' },
              { label: 'Version', value: `v${get(price, 'version', 0)}` },
              { label: 'Tiền tệ', value: toUpper(get(price, 'currency', '')) },
              { label: 'Loại', value: get(price, 'type', '—') },
              { label: 'Cách tính', value: get(price, 'billingScheme', '—') },
              {
                label: 'Trạng thái',
                value: <StatusChip status={get(price, 'active', false) ? 'active' : 'inactive'} />,
              },
              { label: 'Hiệu lực từ', value: formatDate(get(price, 'effectiveAt', '')) },
            ]}
          />
        </DrawerSection>

        {get(price, 'billingScheme') === BillingSchemeEnum.TIERED ? (
          <DrawerSection title={`Bậc giá (${get(price, 'tiersMode', '')})`}>
            <DataTable
              label="Bậc giá"
              rows={tierRows}
              emptyMessage="Price này không có bậc."
              columns={[
                {
                  key: 'upTo',
                  label: 'Đến mức',
                  isRowHeader: true,
                  renderCell: (tier) => {
                    if (tier.upTo === null) {
                      return 'phần còn lại';
                    }

                    return tier.upTo;
                  },
                },
                {
                  key: 'unitAmount',
                  label: 'Đơn giá',
                  renderCell: (tier) => {
                    const { unitAmount } = tier;

                    if (unitAmount === undefined) {
                      return '—';
                    }

                    return formatCurrency(unitAmount, get(price, 'currency', 'vnd'));
                  },
                },
                {
                  key: 'flatAmount',
                  label: 'Phí cố định',
                  renderCell: (tier) => {
                    const { flatAmount } = tier;

                    if (flatAmount === undefined) {
                      return '—';
                    }

                    return formatCurrency(flatAmount, get(price, 'currency', 'vnd'));
                  },
                },
              ]}
            />
          </DrawerSection>
        ) : null}

        {canWrite ? (
          <DrawerSection title="Sửa price">
            <PriceUpdateForm form={form} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
