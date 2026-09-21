import PageCard from '@common/components/PageCard';
import { Alert } from '@heroui/react';

export default function CrmOverviewPage() {
  return (
    <PageCard title="CRM" description="Nhà xe, người liên hệ, deal và hợp đồng — thay HubSpot">
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Module CRM đang được dựng</Alert.Title>
          <Alert.Description>
            Module đã cắm vào ERP: có ô riêng trên màn chọn ứng dụng, sidebar và route riêng dưới
            /crm, schema dữ liệu riêng, và nhận event khách hàng từ Billing. Tính năng sẽ được thêm
            vào đúng chỗ này.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </PageCard>
  );
}
