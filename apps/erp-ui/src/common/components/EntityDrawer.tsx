import { Drawer } from '@heroui/react';
import type { ReactNode } from 'react';

interface EntityDrawerProps {
  isOpen: boolean;
  title: string;
  description?: string;
  tabs?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onOpenChange: (isOpen: boolean) => void;
}

export default function EntityDrawer({
  isOpen,
  title,
  description,
  tabs,
  footer,
  children,
  onOpenChange,
}: EntityDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-[calc(max(33vw,28rem)+200px)] max-w-[calc(100vw-2rem)] sm:w-[calc(max(33vw,28rem)+200px)]">
            <Drawer.CloseTrigger />

            <Drawer.Header>
              <div className="flex flex-col gap-1 pe-10">
                <Drawer.Heading>{title}</Drawer.Heading>
                {description ? <p className="text-sm text-muted">{description}</p> : null}
              </div>
              {tabs}
            </Drawer.Header>

            <Drawer.Body className="flex flex-col gap-4 text-foreground">{children}</Drawer.Body>

            {footer ? <Drawer.Footer>{footer}</Drawer.Footer> : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
