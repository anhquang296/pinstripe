import { Alert, Button, Link } from '@heroui/react';

interface VerifyLinkPanelProps {
  hasLinkKey: boolean;
  isSubmitting: boolean;
  isRejected: boolean;
  onContinue: () => void;
}

export default function VerifyLinkPanel({
  hasLinkKey,
  isSubmitting,
  isRejected,
  onContinue,
}: VerifyLinkPanelProps) {
  if (hasLinkKey && !isRejected) {
    return (
      <Button
        className="w-full"
        isPending={isSubmitting}
        onPress={() => {
          onContinue();
        }}
      >
        Tiếp tục đăng nhập
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Đường dẫn không dùng được</Alert.Title>
          <Alert.Description>
            Đường dẫn đăng nhập không hợp lệ, đã được dùng hoặc đã hết hạn. Hãy yêu cầu một đường
            dẫn mới.
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <Link href="/login">Gửi đường dẫn mới</Link>
    </div>
  );
}
