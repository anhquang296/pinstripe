'use client';

import type { LoginFormData } from '@common/forms/login-form';
import { loginFormDefaultValues, loginFormResolver } from '@common/forms/login-form';
import AuthCard from '@features/auth/components/AuthCard';
import LoginForm from '@features/auth/components/LoginForm';
import { Alert } from '@heroui/react';
import { useCreatePortalLinkMutation } from '@vxrerp/sdk/react/portal';
import { useForm } from 'react-hook-form';

export default function LoginPage() {
  const form = useForm<LoginFormData>({
    resolver: loginFormResolver,
    defaultValues: loginFormDefaultValues,
  });

  const { mutate: createPortalLink, isPending, isSuccess } = useCreatePortalLinkMutation();

  const handleOnSubmit = form.handleSubmit((payload) => {
    createPortalLink(payload);
  });

  return (
    <AuthCard
      title="Đăng nhập cổng nhà xe"
      description="Nhập email thanh toán đã đăng ký với Vexere. Chúng tôi sẽ gửi một đường dẫn đăng nhập dùng một lần."
    >
      {isSuccess ? (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Kiểm tra hộp thư của bạn</Alert.Title>
            <Alert.Description>
              Nếu email này đã đăng ký, đường dẫn đăng nhập vừa được gửi tới. Đường dẫn chỉ dùng
              được một lần và hết hạn sau ít phút.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <LoginForm form={form} isSubmitting={isPending} onSubmit={handleOnSubmit} />
    </AuthCard>
  );
}
