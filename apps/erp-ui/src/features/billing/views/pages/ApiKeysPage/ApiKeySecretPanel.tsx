import { Alert, Button } from '@heroui/react';
import { useState } from 'react';

interface ApiKeySecretPanelProps {
  token: string;
}

export default function ApiKeySecretPanel({ token }: ApiKeySecretPanelProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleOnCopy = async () => {
    await navigator.clipboard.writeText(token);
    setIsCopied(true);
  };

  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content className="gap-2">
        <Alert.Title>Secret chỉ hiện một lần</Alert.Title>
        <Alert.Description>
          Sao chép và cất ngay — đóng drawer là không xem lại được.
        </Alert.Description>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-surface px-2 py-1 font-mono text-xs">
            {token}
          </code>
          <Button size="sm" variant="secondary" onPress={handleOnCopy}>
            {isCopied ? 'Đã sao chép' : 'Sao chép'}
          </Button>
        </div>
      </Alert.Content>
    </Alert>
  );
}
