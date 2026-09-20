import { Check, Copy } from '@gravity-ui/icons';
import { Button, Tooltip } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';

interface EntityCellProps {
  id: string;
  name?: string;
}

const COPY_FEEDBACK_MS = 1500;

export default function EntityCell({ id, name }: EntityCellProps) {
  const [isCopied, setIsCopied] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleOnCopy = async () => {
    await navigator.clipboard.writeText(id);

    setIsCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
    }, COPY_FEEDBACK_MS);
  };

  const copyLabel = isCopied ? 'Đã sao chép' : 'Sao chép ID';

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col">
        {name ? <span className="font-medium">{name}</span> : null}
        <span
          className={
            name ? 'text-app-label font-mono text-[11px]' : 'font-medium font-mono text-xs'
          }
        >
          {id}
        </span>
      </div>

      <span
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Tooltip delay={300}>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            aria-label={copyLabel}
            onPress={handleOnCopy}
          >
            {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
          <Tooltip.Content>{copyLabel}</Tooltip.Content>
        </Tooltip>
      </span>
    </div>
  );
}
