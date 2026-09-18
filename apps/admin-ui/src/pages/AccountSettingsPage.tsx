import { UserProfile } from '@better-auth-ui/heroui';
import PageCard from '@components/PageCard';

export default function AccountSettingsPage() {
  return (
    <PageCard title="Tài khoản" description="Tên hiển thị và ảnh đại diện của bạn.">
      <UserProfile />
    </PageCard>
  );
}
