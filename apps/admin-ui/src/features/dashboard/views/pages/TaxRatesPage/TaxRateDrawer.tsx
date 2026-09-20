import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import StatusChip from '@common/components/StatusChip';
import type { TaxRateFormData } from '@common/forms/tax-rate-form';
import {
  taxRateFormDataToUpdatePayload,
  taxRateFormDefaultValues,
  taxRateFormResolver,
  taxRateToFormData,
} from '@common/forms/tax-rate-form';
import { formatDate } from '@common/utils/format';
import TaxRateForm from '@features/dashboard/components/TaxRateForm';
import { Button } from '@heroui/react';
import { useCan } from '@libs/permissions';
import { PermissionEnum } from '@pinstripe/core/contracts';
import { useTaxRateQuery, useUpdateTaxRateMutation } from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface TaxRateDrawerProps {
  taxRateId: string;
  onClose: () => void;
}

export default function TaxRateDrawer({ taxRateId, onClose }: TaxRateDrawerProps) {
  const canWrite = useCan(PermissionEnum.CATALOG_WRITE);

  const { data: taxRate } = useTaxRateQuery(taxRateId);

  const { mutateAsync: updateTaxRate, isPending: isSaving } = useUpdateTaxRateMutation({
    successMessage: 'Đã cập nhật tax rate.',
  });

  const form = useForm<TaxRateFormData>({
    resolver: taxRateFormResolver,
    defaultValues: taxRateFormDefaultValues,
  });

  useEffect(() => {
    if (taxRate) {
      form.reset(taxRateToFormData(taxRate));
    }
  }, [taxRate, form]);

  const handleOnSave = form.handleSubmit(async (formData) => {
    await updateTaxRate({ id: taxRateId, payload: taxRateFormDataToUpdatePayload(formData) });
  });

  return (
    <EntityDrawer
      isOpen
      title={get(taxRate, 'displayName', taxRateId)}
      description={taxRateId}
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
              { label: 'Thuế suất', value: `${get(taxRate, 'percentage', 0)}%` },
              { label: 'Loại', value: get(taxRate, 'taxType', '—') },
              { label: 'Gồm trong giá', value: get(taxRate, 'inclusive', false) ? 'có' : 'không' },
              { label: 'Phạm vi', value: get(taxRate, 'jurisdiction') || '—' },
              { label: 'Quốc gia', value: get(taxRate, 'country') ?? '—' },
              {
                label: 'Trạng thái',
                value: (
                  <StatusChip status={get(taxRate, 'active', false) ? 'active' : 'inactive'} />
                ),
              },
              { label: 'Tạo lúc', value: formatDate(get(taxRate, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        {canWrite ? (
          <DrawerSection title="Sửa tax rate">
            <TaxRateForm mode="edit" form={form} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        ) : null}
      </div>
    </EntityDrawer>
  );
}
