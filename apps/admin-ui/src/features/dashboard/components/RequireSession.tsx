import { useAuthenticate } from '@better-auth-ui/react';
import { Spinner } from '@heroui/react';
import { authClient } from '@libs/auth-client';
import { Outlet } from 'react-router-dom';

export default function RequireSession() {
  const { data: session, isPending } = useAuthenticate(authClient);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (session) {
    return <Outlet />;
  }

  return null;
}
