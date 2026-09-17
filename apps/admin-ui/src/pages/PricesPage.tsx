import PriceItem from '@components/PriceItem';
import { usePricesQuery } from '@pinstripe/sdk/react';
import { map } from 'lodash-es';

const PAGE_LIMIT = 50;

export default function PricesPage() {
  const {
    data: prices,
    isPending,
    error,
  } = usePricesQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prices</h1>
        <p className="text-sm text-slate-500">
          Giá là bất biến: đổi giá sinh version mới, version cũ vẫn phục vụ hợp đồng cũ.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Lookup key</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Giá</th>
              <th className="px-4 py-3">Chu kỳ</th>
              <th className="px-4 py-3">Hiệu lực từ</th>
            </tr>
          </thead>
          <tbody>
            {map(prices?.data, (price) => {
              return <PriceItem key={price.id} price={price} />;
            })}
          </tbody>
        </table>
        {isPending ? <p className="px-4 py-3 text-slate-500">Đang tải…</p> : null}
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>
    </div>
  );
}
