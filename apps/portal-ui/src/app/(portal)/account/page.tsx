'use client';

import DetailList from '@common/components/DetailList';
import PageCard from '@common/components/PageCard';
import type { PortalRequestFormData } from '@common/forms/portal-request-form';
import {
  portalRequestFormDefaultValues,
  portalRequestFormResolver,
} from '@common/forms/portal-request-form';
import { formatCurrency, formatDateTime } from '@common/utils/format';
import PaymentMethodList from '@features/portal/components/PaymentMethodList';
import PortalRequestForm from '@features/portal/components/PortalRequestForm';
import { PORTAL_ROLE_LABELS } from '@features/portal/constants/labels';
import { Alert, Card, Link } from '@heroui/react';
import { PortalRequestKindEnum } from '@pinstripe/core/contracts';
import type { PortalIdentityResponse } from '@pinstripe/sdk';
import {
  useCreatePortalRequestMutation,
  usePortalAccountQuery,
  usePortalPaymentMethodsQuery,
} from '@pinstripe/sdk/react/portal';
import { compact, get, join, toUpper } from 'lodash-es';
import { useForm } from 'react-hook-form';

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

function buildCreditLabel(account: PortalIdentityResponse): string {
  if (account.balance < 0) {
    return formatCurrency(-account.balance, account.currency);
  }

  return 'Không có';
}

export default function AccountPage() {
  const { data: account } = usePortalAccountQuery();

  const { data: paymentMethods } = usePortalPaymentMethodsQuery({ limit: 20 });

  const form = useForm<PortalRequestFormData>({
    resolver: portalRequestFormResolver,
    defaultValues: portalRequestFormDefaultValues,
  });

  const { mutate: createPortalRequest, isPending: isSubmitting } = useCreatePortalRequestMutation({
    successMessage: 'Đã gửi yêu cầu. Kế toán Vexere sẽ liên hệ với nhà xe.',
  });

  const handleOnSubmit = form.handleSubmit((data) => {
    createPortalRequest(
      { kind: PortalRequestKindEnum.PROFILE_UPDATE, message: data.message },
      {
        onSuccess: () => {
          form.reset(portalRequestFormDefaultValues);
        },
      },
    );
  });

  if (account) {
    const { sessionExpiresAt, accountantName, accountantEmail, role, userEmail } = account;

    const roleLabel = role ? PORTAL_ROLE_LABELS[role] : 'Truy cập bằng link Vexere gửi';
    const sessionLabel = sessionExpiresAt ? formatDateTime(sessionExpiresAt) : '—';

    const accountantEmailValue = accountantEmail ? (
      <Link href={`mailto:${accountantEmail}`}>{accountantEmail}</Link>
    ) : (
      '—'
    );

    return (
      <PageCard title="Tài khoản" description="Thông tin thanh toán Vexere đang lưu cho nhà xe.">
        <Card>
          <Card.Content>
            <DetailList
              items={[
                { label: 'Tên nhà xe', value: account.name },
                { label: 'Bạn đăng nhập bằng', value: buildOptionalText(userEmail) },
                { label: 'Vai trò của bạn', value: roleLabel },
                { label: 'Mã số thuế', value: buildOptionalText(account.taxId) },
                { label: 'Email thanh toán', value: buildOptionalText(account.email) },
                { label: 'Số điện thoại', value: buildOptionalText(account.phone) },
                { label: 'Địa chỉ', value: buildAddressLabel(account.address) },
                { label: 'Tiền tệ thanh toán', value: toUpper(account.currency) },
                { label: 'Số dư tín dụng', value: buildCreditLabel(account) },
                { label: 'Phiên đăng nhập hết hạn', value: sessionLabel },
              ]}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex flex-col gap-1">
            <Card.Title>Kế toán Vexere phụ trách</Card.Title>
            <Card.Description>
              Liên hệ khi hóa đơn có sai sót, cần đối soát hoặc cần cập nhật tên, mã số thuế, email
              thanh toán. Email thanh toán cũng là địa chỉ nhận đường dẫn đăng nhập.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <DetailList
              items={[
                { label: 'Họ tên', value: buildOptionalText(accountantName) },
                { label: 'Email', value: accountantEmailValue },
              ]}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex flex-col gap-1">
            <Card.Title>Yêu cầu cập nhật hồ sơ</Card.Title>
            <Card.Description>
              Tên pháp nhân, mã số thuế, địa chỉ và email thanh toán do kế toán Vexere cập nhật. Ghi
              rõ thông tin cần sửa để kế toán xử lý.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <PortalRequestForm
              form={form}
              placeholder="Ví dụ: đổi email thanh toán sang ketoan2@nhaxe.vn."
              isSubmitting={isSubmitting}
              onSubmit={handleOnSubmit}
            />
          </Card.Content>
        </Card>

        <PaymentMethodList paymentMethods={get(paymentMethods, 'data', [])} />

        {account.balance < 0 ? (
          <Alert status="accent">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Số dư tín dụng sẽ được trừ tự động</Alert.Title>
              <Alert.Description>
                Khoản tín dụng của nhà xe được cấn trừ vào hóa đơn kế tiếp khi hóa đơn được phát
                hành.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </PageCard>
    );
  }

  return null;
}
