import { useCallback, useState } from 'react';
import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import {
  useAdvanceTestClockMutation,
  useCreateTestClockMutation,
  useTestClocksQuery,
} from '@reactquery/test-clocks';

const PAGE_LIMIT = 20;

export default function TestClocksPage() {
  const [name, setName] = useState('');
  const [advanceTargets, setAdvanceTargets] = useState<Record<string, string>>({});
  const testClocksQuery = useTestClocksQuery({ limit: PAGE_LIMIT }, { hasPlaceholder: true });
  const createTestClockMutation = useCreateTestClockMutation();
  const advanceTestClockMutation = useAdvanceTestClockMutation();

  const handleOnNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  const handleOnCreateClick = useCallback(async () => {
    if (name.trim().length === 0) {
      return;
    }

    await createTestClockMutation.mutateAsync({
      name: name.trim(),
      frozenTime: new Date().toISOString(),
    });
    setName('');
  }, [createTestClockMutation, name]);

  const handleOnTargetChange = useCallback((testClockId: string, value: string) => {
    setAdvanceTargets((current) => ({ ...current, [testClockId]: value }));
  }, []);

  const handleOnAdvanceClick = useCallback(
    (testClockId: string) => {
      const target = advanceTargets[testClockId];

      if (!target) {
        return;
      }

      advanceTestClockMutation.mutate({
        id: testClockId,
        payload: { frozenTime: new Date(target).toISOString() },
      });
    },
    [advanceTargets, advanceTestClockMutation],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Test clocks</h1>
        <p className="text-sm text-slate-500">
          Tua thời gian để thấy trial kết thúc, kỳ cuốn sang kỳ mới và subscription hủy cuối kỳ.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <TextField
          label="Tên đồng hồ"
          placeholder="Demo kế toán"
          value={name}
          onChange={handleOnNameChange}
        />
        <Button onClick={handleOnCreateClick} disabled={createTestClockMutation.isPending}>
          Tạo test clock
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Thời điểm đang đứng</th>
              <th className="px-4 py-3">Tua tới</th>
            </tr>
          </thead>
          <tbody>
            {testClocksQuery.data?.data.map((clock) => (
              <TestClockRow
                key={clock.id}
                clockId={clock.id}
                name={clock.name}
                frozenTime={clock.frozenTime}
                target={advanceTargets[clock.id] ?? ''}
                onTargetChange={handleOnTargetChange}
                onAdvance={handleOnAdvanceClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TestClockRowProps {
  clockId: string;
  name: string;
  frozenTime: string;
  target: string;
  onTargetChange: (testClockId: string, value: string) => void;
  onAdvance: (testClockId: string) => void;
}

function TestClockRow({
  clockId,
  name,
  frozenTime,
  target,
  onTargetChange,
  onAdvance,
}: TestClockRowProps) {
  const handleOnChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onTargetChange(clockId, event.target.value);
    },
    [clockId, onTargetChange],
  );

  const handleOnClick = useCallback(() => {
    onAdvance(clockId);
  }, [clockId, onAdvance]);

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{clockId}</td>
      <td className="px-4 py-3">{name}</td>
      <td className="px-4 py-3 text-slate-600">{new Date(frozenTime).toLocaleString('vi-VN')}</td>
      <td className="px-4 py-3">
        <div className="flex items-end gap-2">
          <input
            type="datetime-local"
            value={target}
            onChange={handleOnChange}
            className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
          />
          <Button variant="ghost" onClick={handleOnClick}>
            Tua
          </Button>
        </div>
      </td>
    </tr>
  );
}
