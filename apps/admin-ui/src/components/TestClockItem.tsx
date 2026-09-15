import Button from '@components/ui/Button';
import type { TestClockResponse } from '@pinstripe/core/contracts';
import { useCallback } from 'react';

interface TestClockItemProps {
  testClock: TestClockResponse;
  target: string;
  onTargetChange: (testClockId: string, target: string) => void;
  onAdvance: (testClockId: string) => void;
}

export default function TestClockItem({
  testClock,
  target,
  onTargetChange,
  onAdvance,
}: TestClockItemProps) {
  const handleOnTargetChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTargetChange(testClock.id, event.target.value);
    },
    [onTargetChange, testClock.id],
  );

  const handleOnAdvance = useCallback(() => {
    onAdvance(testClock.id);
  }, [onAdvance, testClock.id]);

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{testClock.id}</td>
      <td className="px-4 py-3">{testClock.name}</td>
      <td className="px-4 py-3 text-slate-600">
        {new Date(testClock.frozenTime).toLocaleString('vi-VN')}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-end gap-2">
          <input
            type="datetime-local"
            value={target}
            onChange={handleOnTargetChange}
            className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
          />
          <Button variant="ghost" onClick={handleOnAdvance}>
            Tua
          </Button>
        </div>
      </td>
    </tr>
  );
}
