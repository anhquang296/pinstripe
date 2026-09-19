import ApiKeyForm from '@components/ApiKeyForm';
import ConfirmDialog from '@components/ConfirmDialog';
import DataTable from '@components/DataTable';
import DrawerSection from '@components/DrawerSection';
import EntityDrawer from '@components/EntityDrawer';
import FilterBar from '@components/FilterBar';
import PageCard from '@components/PageCard';
import StatGrid from '@components/StatGrid';
import StatItem from '@components/StatItem';
import StatusChip from '@components/StatusChip';
import { PAGE_LIMIT } from '@constants/pagination';
import type { ApiKeyFormData } from '@forms/api-key-form';
import {
  apiKeyFormDataToPayload,
  apiKeyFormDefaultValues,
  apiKeyFormResolver,
} from '@forms/api-key-form';
import { Button } from '@heroui/react';
import { useCursorPagination } from '@hooks/useCursorPagination';
import { formatDate } from '@lib/format';
import { useCan } from '@lib/permissions';
import type { ApiKeyResponse } from '@pinstripe/core/contracts';
import { ApiKeyTypeEnum, PermissionEnum } from '@pinstripe/core/contracts';
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
} from '@pinstripe/sdk/react';
import { filter, get, join, last, reject, size } from 'lodash-es';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import ApiKeySecretPanel from './ApiKeySecretPanel';

export default function ApiKeysPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState('');
  const [revokingApiKey, setRevokingApiKey] = useState<ApiKeyResponse | null>(null);
  const { startingAfter, hasPrevious, advancePage, revertPage } = useCursorPagination();
  const canManage = useCan(PermissionEnum.API_KEY_MANAGE);

  const { data: apiKeys, isPending } = useApiKeysQuery(
    { limit: PAGE_LIMIT, startingAfter },
    { hasPlaceholder: true },
  );

  const { mutateAsync: createApiKey, isPending: isSaving } = useCreateApiKeyMutation({
    successMessage: 'Đã tạo API key.',
  });
  const { mutateAsync: deleteApiKey, isPending: isRevoking } = useDeleteApiKeyMutation({
    successMessage: 'Đã thu hồi API key.',
  });

  const form = useForm<ApiKeyFormData>({
    resolver: apiKeyFormResolver,
    defaultValues: apiKeyFormDefaultValues,
  });

  const rows = get(apiKeys, 'data', []);
  const hasMore = get(apiKeys, 'hasMore', false);

  const handleOnSave = form.handleSubmit(async (formData) => {
    const { token } = await createApiKey(apiKeyFormDataToPayload(formData));

    if (token) {
      setCreatedToken(token);
    }

    form.reset(apiKeyFormDefaultValues);
  });

  const handleOnCreateOpenChange = (isOpen: boolean) => {
    setIsCreateOpen(isOpen);

    if (!isOpen) {
      setCreatedToken('');
    }
  };

  const handleOnNext = () => {
    const lastApiKey = last(rows);

    if (lastApiKey) {
      advancePage(lastApiKey.id);
    }
  };

  const handleOnRevoke = async () => {
    if (revokingApiKey) {
      await deleteApiKey(revokingApiKey.id);
      setRevokingApiKey(null);
    }
  };

  return (
    <PageCard
      title="API keys"
      description="Khoá của machine caller. Scope quyết định bề mặt gọi được; thu hồi là không quay lại được."
      actions={
        canManage ? (
          <Button
            onPress={() => {
              handleOnCreateOpenChange(true);
            }}
          >
            Tạo API key
          </Button>
        ) : null
      }
    >
      <StatGrid>
        <StatItem label="Khoá trang này" value={size(rows)} />
        <StatItem label="Còn hiệu lực" value={size(reject(rows, 'revokedAt'))} />
        <StatItem label="Đã thu hồi" value={size(filter(rows, 'revokedAt'))} />
        <StatItem label="Khoá secret" value={size(filter(rows, { type: ApiKeyTypeEnum.SECRET }))} />
      </StatGrid>

      <DataTable
        toolbar={<FilterBar itemCount={size(rows)} />}
        label="Danh sách API key"
        rows={rows}
        isLoading={isPending}
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        emptyMessage="Chưa có API key nào."
        onNext={handleOnNext}
        onPrevious={revertPage}
        columns={[
          {
            key: 'name',
            label: 'Tên khoá',
            isRowHeader: true,
            renderCell: (apiKey) => {
              return (
                <div className="flex flex-col">
                  <span className="font-medium">{apiKey.name}</span>
                  <span className="text-app-label font-mono text-[11px]">{apiKey.id}</span>
                </div>
              );
            },
          },
          {
            key: 'type',
            label: 'Loại',
            renderCell: (apiKey) => {
              return apiKey.type;
            },
          },
          {
            key: 'scopes',
            label: 'Scope',
            renderCell: (apiKey) => {
              return <span className="font-mono text-[11px]">{join(apiKey.scopes, ', ')}</span>;
            },
          },
          {
            key: 'tokenPrefix',
            label: 'Tiền tố',
            renderCell: (apiKey) => {
              return <span className="font-mono text-[11px]">{apiKey.tokenPrefix}…</span>;
            },
          },
          {
            key: 'status',
            label: 'Trạng thái',
            renderCell: (apiKey) => {
              return <StatusChip status={apiKey.revokedAt === null ? 'active' : 'voided'} />;
            },
          },
          {
            key: 'lastUsedAt',
            label: 'Dùng gần nhất',
            renderCell: (apiKey) => {
              const { lastUsedAt } = apiKey;

              return lastUsedAt === null ? '—' : formatDate(lastUsedAt);
            },
          },
          {
            key: 'createdAt',
            label: 'Tạo lúc',
            renderCell: (apiKey) => {
              return formatDate(apiKey.createdAt);
            },
          },
          {
            key: 'actions',
            label: 'Thao tác',
            renderCell: (apiKey) => {
              if (!canManage || apiKey.revokedAt !== null) {
                return '—';
              }

              return (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setRevokingApiKey(apiKey);
                  }}
                >
                  Thu hồi
                </Button>
              );
            },
          },
        ]}
      />

      <EntityDrawer
        isOpen={isCreateOpen}
        title="Tạo API key"
        description="Token đầy đủ chỉ trả về đúng một lần, trong phản hồi tạo khoá."
        onOpenChange={handleOnCreateOpenChange}
      >
        <div className="flex flex-col gap-4">
          {createdToken ? <ApiKeySecretPanel token={createdToken} /> : null}

          <DrawerSection title="Khoá mới">
            <ApiKeyForm form={form} isSaving={isSaving} onSave={handleOnSave} />
          </DrawerSection>
        </div>
      </EntityDrawer>

      <ConfirmDialog
        isOpen={revokingApiKey !== null}
        title="Thu hồi API key"
        description={`Khoá ${get(revokingApiKey, 'name', '')} sẽ ngừng gọi được API ngay lập tức. Thao tác này không quay lại được.`}
        confirmLabel="Thu hồi"
        isConfirming={isRevoking}
        onConfirm={handleOnRevoke}
        onOpenChange={() => {
          setRevokingApiKey(null);
        }}
      />
    </PageCard>
  );
}
