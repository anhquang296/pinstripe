'use client';

import DetailList from '@common/components/DetailList';
import PageCard from '@common/components/PageCard';
import { formatDateTime } from '@common/utils/format';
import { Alert, Card } from '@heroui/react';
import type { PortalIdentityResponse } from '@pinstripe/sdk';
import { usePortalAccountQuery } from '@pinstripe/sdk/react/portal';
import { compact, join, toUpper } from 'lodash-es';

function buildOptionalText(value: string | null): string {
  if (value) {
    return value;
  }

  return '—';
}

function buildAddressLabel(address: PortalIdentityResponse['address']): string {
  if (address) {
    const { line1, line2, city, state, country } = address;

    return buildOptionalText(join(compact([line1, line2, city, state, country]), ', '));
  }

  return '—';
}

export default function AccountPage() {
  const { data: account } = usePortalAccountQuery();

  if (account) {
    const { sessionExpiresAt } = account;
    const sessionLabel = sessionExpiresAt ? formatDateTime(sessionExpiresAt) : '—';

    return (
      <PageCard title="Tài khoản" description="Thông tin thanh toán Vexere đang lưu cho nhà xe.">
        <Card>
          <Card.Content>
            <DetailList
              items={[
                { label: 'Tên nhà xe', value: account.name },
                { label: 'Mã số thuế', value: buildOptionalText(account.taxId) },
                { label: 'Email thanh toán', value: buildOptionalText(account.email) },
                { label: 'Số điện thoại', value: buildOptionalText(account.phone) },
                { label: 'Địa chỉ', value: buildAddressLabel(account.address) },
                { label: 'Tiền tệ thanh toán', value: toUpper(account.currency) },
                { label: 'Phiên đăng nhập hết hạn', value: sessionLabel },
              ]}
            />
          </Card.Content>
        </Card>

        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Cần thay đổi thông tin?</Alert.Title>
            <Alert.Description>
              Liên hệ kế toán Vexere phụ trách nhà xe để cập nhật tên, mã số thuế hoặc email thanh
              toán. Email thanh toán cũng là địa chỉ nhận đường dẫn đăng nhập.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </PageCard>
    );
  }

  return null;
}
