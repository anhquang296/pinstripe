import PageCard from '@common/components/PageCard';
import { Alert } from '@heroui/react';

export default function CrmSettingsPage() {
  return (
    <PageCard title="Cài đặt CRM" description="Cấu hình riêng của module CRM">
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Cài đặt của một module nằm trong chính module đó</Alert.Title>
          <Alert.Description>
            Pipeline, stage của deal và nguồn khách sẽ được cấu hình ở đây. Cài đặt chung của cả ERP
            — tài khoản, người dùng, vai trò, tích hợp — nằm ở ứng dụng Cài đặt.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </PageCard>
  );
}
