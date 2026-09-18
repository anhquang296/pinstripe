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
        <Drawer.Content
          placement="right"
          className="w-[min(980px,100vw-96px)] max-w-none bg-surface"
        >
          <Drawer.Dialog className="flex h-full flex-col">
            <Drawer.Header className="border-app-border-soft flex items-start justify-between gap-4 border-b px-4 py-3">
              <div className="flex flex-col gap-1">
                <Drawer.Heading className="text-[16px] leading-6 font-semibold">
                  {title}
                </Drawer.Heading>
                {description ? (
                  <span className="text-app-description text-[12px]">{description}</span>
                ) : null}
                {tabs}
              </div>
              <Drawer.CloseTrigger />
            </Drawer.Header>

            <Drawer.Body className="flex-1 overflow-y-auto bg-background p-4">
              {children}
            </Drawer.Body>

            {footer ? (
              <Drawer.Footer className="border-app-border-soft flex items-center justify-end gap-2 border-t px-4 py-3">
                {footer}
              </Drawer.Footer>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
