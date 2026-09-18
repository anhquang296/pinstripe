import { Button } from '@heroui/react';
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
    <div className="border-app-border-soft flex flex-col gap-2 rounded-md border bg-warning-soft p-3">
      <span className="text-[12px] font-semibold">
        Secret chỉ hiện một lần. Sao chép và cất ngay — đóng drawer là không xem lại được.
      </span>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-xs bg-surface px-2 py-1 font-mono text-[12px]">
          {token}
        </code>
        <Button size="sm" variant="ghost" onPress={handleOnCopy}>
          {isCopied ? 'Đã sao chép' : 'Sao chép'}
        </Button>
      </div>
    </div>
  );
}
