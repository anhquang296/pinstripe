import { Bell } from '@gravity-ui/icons';
import { Badge, Button, Popover } from '@heroui/react';

export default function NotificationButton() {
  const unreadCount = 0;

  return (
    <Badge.Anchor>
      <Popover>
        <Button isIconOnly variant="tertiary" aria-label="Thông báo">
          <Bell />
        </Button>

        <Popover.Content>
          <Popover.Dialog className="w-72">
            <Popover.Heading>Thông báo</Popover.Heading>

            <p className="text-muted mt-2 text-sm">Chưa có thông báo nào.</p>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>

      {unreadCount > 0 ? (
        <Badge color="danger" size="sm">
          {unreadCount}
        </Badge>
      ) : null}
    </Badge.Anchor>
  );
}
