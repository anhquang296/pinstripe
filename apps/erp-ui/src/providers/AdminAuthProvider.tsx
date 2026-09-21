import { AuthProvider } from '@better-auth-ui/heroui';
import { adminPaths } from '@features/admin/routes/paths';
import { authClient } from '@libs/auth-client';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AdminAuthProviderProps {
  children: ReactNode;
}

const MIN_PASSWORD_LENGTH = 12;

const AUTH_LOCALIZATION = {
  auth: {
    signIn: 'Đăng nhập',
    signOut: 'Đăng xuất',
    email: 'Email',
    emailPlaceholder: 'ban@congty.vn',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Mật khẩu',
    showPassword: 'Hiện mật khẩu',
    hidePassword: 'Ẩn mật khẩu',
    fieldRequired: 'Trường này là bắt buộc',
    invalidEmail: 'Email không hợp lệ',
    tooShort: 'Phải có ít nhất {{min}} ký tự',
    tooLong: 'Tối đa {{max}} ký tự',
    or: 'HOẶC',
    account: 'Tài khoản',
    continueWith: 'Tiếp tục với {{provider}}',
  },
  errors: {
    generic: 'Có lỗi xảy ra. Thử lại giúp mình.',
    invalidCredentials: 'Email hoặc mật khẩu không đúng.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn.',
    permissionDenied: 'Bạn không có quyền thực hiện việc này.',
    rateLimited: 'Bạn thao tác quá nhanh, thử lại sau.',
    passwordTooShort: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
  },
  settings: {
    account: 'Tài khoản',
    security: 'Bảo mật',
    save: 'Lưu',
    cancel: 'Huỷ',
  },
};

const isGoogleEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true';

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <AuthProvider
      authClient={authClient}
      queryClient={queryClient}
      redirectTo="/"
      basePaths={{ settings: adminPaths.SETTINGS }}
      emailAndPassword={{
        enabled: true,
        forgotPassword: false,
        minPasswordLength: MIN_PASSWORD_LENGTH,
      }}
      socialProviders={isGoogleEnabled ? ['google'] : []}
      localization={AUTH_LOCALIZATION}
      navigate={({ to, replace }) => {
        navigate(to, { replace });
      }}
    >
      {children}
    </AuthProvider>
  );
}
