import DataTable from '@common/components/DataTable';
import DetailList from '@common/components/DetailList';
import DrawerSection from '@common/components/DrawerSection';
import EntityDrawer from '@common/components/EntityDrawer';
import { PAGE_LIMIT } from '@common/constants/pagination';
import { formatCurrency, formatDate } from '@common/utils/format';
import { Button } from '@heroui/react';
import { CurrencyEnum, LedgerAccountCodeEnum } from '@vxrerp/core/contracts';
import { useLedgerAccountQuery, useLedgerTransactionsQuery } from '@vxrerp/sdk/react';
import { get, size } from 'lodash-es';

interface LedgerAccountDrawerProps {
  ledgerAccountId: string;
  onClose: () => void;
}

export default function LedgerAccountDrawer({
  ledgerAccountId,
  onClose,
}: LedgerAccountDrawerProps) {
  const { data: ledgerAccount } = useLedgerAccountQuery(ledgerAccountId);

  const { data: ledgerTransactions } = useLedgerTransactionsQuery({
    accountId: ledgerAccountId,
    limit: PAGE_LIMIT,
  });

  const currency = get(ledgerAccount, 'currency', CurrencyEnum.VND);

  return (
    <EntityDrawer
      isOpen
      title={get(ledgerAccount, 'code', LedgerAccountCodeEnum.CASH)}
      description={ledgerAccountId}
      footer={
        <Button variant="ghost" onPress={onClose}>
          Đóng
        </Button>
      }
      onOpenChange={onClose}
    >
      <div className="flex flex-col gap-4">
        <DrawerSection title="Tóm tắt">
          <DetailList
            items={[
              { label: 'Loại', value: get(ledgerAccount, 'type', '—') },
              { label: 'Số dư thường', value: get(ledgerAccount, 'normalBalance', '—') },
              { label: 'Khách hàng', value: get(ledgerAccount, 'customerId') ?? '—' },
              { label: 'Nợ', value: formatCurrency(get(ledgerAccount, 'debits', 0), currency) },
              { label: 'Có', value: formatCurrency(get(ledgerAccount, 'credits', 0), currency) },
              {
                label: 'Số dư',
                value: formatCurrency(get(ledgerAccount, 'balance', 0), currency),
              },
              { label: 'Tạo lúc', value: formatDate(get(ledgerAccount, 'createdAt', '')) },
            ]}
          />
        </DrawerSection>

        <DataTable
          label="Bút toán gần đây"
          rows={get(ledgerTransactions, 'data', [])}
          emptyMessage="Tài khoản này chưa có bút toán."
          columns={[
            {
              key: 'description',
              label: 'Diễn giải',
              isRowHeader: true,
              renderCell: (ledgerTransaction) => {
                return (
                  <div className="flex flex-col">
                    <span className="font-medium">{ledgerTransaction.description}</span>
                    <span className="text-app-label font-mono text-[11px]">
                      {ledgerTransaction.id}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'postings',
              label: 'Số dòng',
              renderCell: (ledgerTransaction) => {
                return size(ledgerTransaction.postings);
              },
            },
            {
              key: 'effectiveAt',
              label: 'Hiệu lực',
              renderCell: (ledgerTransaction) => {
                return formatDate(ledgerTransaction.effectiveAt);
              },
            },
          ]}
        />
      </div>
    </EntityDrawer>
  );
}
