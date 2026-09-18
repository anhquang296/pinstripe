import { Auth } from '@better-auth-ui/heroui';
import { get } from 'lodash-es';
import { useParams } from 'react-router-dom';

export default function AuthPage() {
  const params = useParams();
  const path = get(params, 'path', 'sign-in');

  return (
    <div className="auth-view flex min-h-screen items-center justify-center bg-background p-6">
      <Auth path={path} className="w-full max-w-sm" />
    </div>
  );
}
