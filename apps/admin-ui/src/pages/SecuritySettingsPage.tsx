import { ChangePassword } from '@better-auth-ui/heroui';
import { useRevokeOtherSessions } from '@better-auth-ui/react';
import PageCard from '@components/PageCard';
import { Button, Card } from '@heroui/react';
import { authClient } from '@lib/auth-client';
import { toast } from '@lib/toast';

export default function SecuritySettingsPage() {
  const { mutate: revokeOtherSessions, isPending } = useRevokeOtherSessions(authClient, {
    onSuccess: () => {
      toast.show('Đã đăng xuất mọi thiết bị khác.');
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });

  const handleOnRevokeOtherSessions = () => {
    revokeOtherSessions();
  };

  return (
    <PageCard title="Bảo mật" description="Mật khẩu và các phiên đăng nhập của bạn.">
      <ChangePassword />

      <Card>
        <Card.Header>
          <Card.Title>Phiên đăng nhập khác</Card.Title>
          <Card.Description>
            Đăng xuất mọi thiết bị khác, giữ nguyên phiên hiện tại.
          </Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button variant="danger" isDisabled={isPending} onPress={handleOnRevokeOtherSessions}>
            Đăng xuất thiết bị khác
          </Button>
        </Card.Footer>
      </Card>
    </PageCard>
  );
}
