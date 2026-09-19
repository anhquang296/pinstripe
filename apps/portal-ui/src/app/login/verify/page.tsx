'use client';

import AuthCard from '@features/auth/components/AuthCard';
import VerifyLinkPanel from '@features/auth/components/VerifyLinkPanel';
import { useCreatePortalSessionMutation } from '@pinstripe/sdk/react/portal';
import { isString } from 'lodash-es';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface VerifyLinkPageProps {
  searchParams: Promise<{ linkKey?: string | string[] }>;
}

export default function VerifyLinkPage({ searchParams }: VerifyLinkPageProps) {
  const { linkKey } = use(searchParams);
  const router = useRouter();
  const { mutate: createPortalSession, isPending, isError } = useCreatePortalSessionMutation();

  const handleOnContinue = () => {
    if (isString(linkKey)) {
      createPortalSession(
        { linkKey },
        {
          onSuccess: () => {
            router.replace('/');
          },
        },
      );
    }
  };

  return (
    <AuthCard
      title="Đăng nhập cổng nhà xe"
      description="Xác nhận để mở phiên làm việc trên trình duyệt này."
    >
      <VerifyLinkPanel
        hasLinkKey={isString(linkKey)}
        isSubmitting={isPending}
        isRejected={isError}
        onContinue={handleOnContinue}
      />
    </AuthCard>
  );
}
