import { useAuth, useSession } from '@better-auth-ui/react';
import { Spinner } from '@heroui/react';
import { authClient } from '@libs/auth-client';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export default function RequireSession() {
  const { basePaths, viewPaths, navigate } = useAuth();
  const { pathname, search } = useLocation();
  const { data: session, isFetching } = useSession(authClient);
  const isSignedOut = !session && !isFetching;

  useEffect(() => {
    if (isSignedOut) {
      const redirectTo = encodeURIComponent(`${pathname}${search}`);

      navigate({
        to: `${basePaths.auth}/${viewPaths.auth.signIn}?redirectTo=${redirectTo}`,
        replace: true,
      });
    }
  }, [isSignedOut, pathname, search, basePaths.auth, viewPaths.auth.signIn, navigate]);

  if (session) {
    return <Outlet />;
  }

  if (isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return null;
}
