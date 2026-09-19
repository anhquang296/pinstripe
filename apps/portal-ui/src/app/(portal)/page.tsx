'use client';

import { formatDateTime } from '@common/utils/format';
import { Card } from '@heroui/react';
import { usePortalAccountQuery } from '@pinstripe/sdk/react/portal';
import { toUpper } from 'lodash-es';

export default function OverviewPage() {
  const { data: account } = usePortalAccountQuery();

  if (account) {
    const { email, sessionExpiresAt } = account;

    return (
      <section className="flex flex-col gap-4">
        <Card>
          <Card.Header className="flex flex-col gap-1">
            <Card.Title>Tổng quan</Card.Title>
            <Card.Description>Thông tin tài khoản thanh toán của nhà xe.</Card.Description>
          </Card.Header>
        </Card>

        <Card>
          <Card.Content>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted uppercase">Nhà xe</dt>
                <dd>{account.name}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted uppercase">Email thanh toán</dt>
                <dd>{email || '—'}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted uppercase">Tiền tệ</dt>
                <dd>{toUpper(account.currency)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted uppercase">Phiên đăng nhập hết hạn</dt>
                <dd>{sessionExpiresAt ? formatDateTime(sessionExpiresAt) : '—'}</dd>
              </div>
            </dl>
          </Card.Content>
        </Card>
      </section>
    );
  }

  return null;
}
