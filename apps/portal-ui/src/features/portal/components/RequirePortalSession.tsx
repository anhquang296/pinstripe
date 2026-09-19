'use client';

import { Alert, Spinner } from '@heroui/react';
import type { PortalIdentityResponse } from '@pinstripe/sdk';
import { usePortalAccountQuery } from '@pinstripe/sdk/react/portal';
import { get } from 'lodash-es';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface RequirePortalSessionProps {
  children: (account: PortalIdentityResponse) => ReactNode;
}

export default function RequirePortalSession({ children }: RequirePortalSessionProps) {
  const router = useRouter();
  const { data: account, error, isPending } = usePortalAccountQuery();
  const isSignedOut = get(error, 'statusCode') === 401;

  useEffect(() => {
    if (isSignedOut) {
      router.replace('/login');
    }
  }, [isSignedOut, router]);

  if (account) {
    return children(account);
  }

  if (isPending || isSignedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Alert status="danger" className="max-w-md">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Không tải được cổng nhà xe</Alert.Title>
          <Alert.Description>Vui lòng tải lại trang sau ít phút.</Alert.Description>
        </Alert.Content>
      </Alert>
    </div>
  );
}
