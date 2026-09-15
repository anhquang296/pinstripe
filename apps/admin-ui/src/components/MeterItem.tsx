import type { MeterResponse } from '@api/meters';

interface MeterItemProps {
  meter: MeterResponse;
}

export default function MeterItem({ meter }: MeterItemProps) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{meter.id}</td>
      <td className="px-4 py-3">{meter.displayName}</td>
      <td className="px-4 py-3 font-mono text-xs">{meter.eventName}</td>
      <td className="px-4 py-3">{meter.aggregation}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{meter.valueKey}</td>
      <td className="px-4 py-3">
        <span
          className={
            meter.status === 'active'
              ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
          }
        >
          {meter.status}
        </span>
      </td>
    </tr>
  );
}
