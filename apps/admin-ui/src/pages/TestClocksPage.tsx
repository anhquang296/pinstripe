import TestClockItem from '@components/TestClockItem';
import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import {
  useAdvanceTestClockMutation,
  useCreateTestClockMutation,
  useTestClocksQuery,
} from '@reactquery/test-clocks';
import { useCallback, useState } from 'react';

const PAGE_LIMIT = 20;

export default function TestClocksPage() {
  const [name, setName] = useState('');
  const [advanceTargets, setAdvanceTargets] = useState<Record<string, string>>({});
  const { data: testClocks, error } = useTestClocksQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { mutateAsync: createTestClock, isPending: isCreating } = useCreateTestClockMutation();
  const { mutate: advanceTestClock } = useAdvanceTestClockMutation();

  const handleOnNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  const handleOnCreateClick = useCallback(async () => {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return;
    }

    await createTestClock({ name: trimmedName, frozenTime: new Date().toISOString() });
    setName('');
  }, [createTestClock, name]);

  const handleOnTargetChange = useCallback((testClockId: string, target: string) => {
    setAdvanceTargets((currentTargets) => {
      return { ...currentTargets, [testClockId]: target };
    });
  }, []);

  const handleOnAdvance = useCallback(
    (testClockId: string) => {
      const target = advanceTargets[testClockId];

      if (!target) {
        return;
      }

      advanceTestClock({
        id: testClockId,
        payload: { frozenTime: new Date(target).toISOString() },
      });
    },
    [advanceTargets, advanceTestClock],
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
        <Button onClick={handleOnCreateClick} disabled={isCreating}>
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
            {testClocks?.data.map((testClock) => {
              return (
                <TestClockItem
                  key={testClock.id}
                  testClock={testClock}
                  target={advanceTargets[testClock.id] ?? ''}
                  onTargetChange={handleOnTargetChange}
                  onAdvance={handleOnAdvance}
                />
              );
            })}
          </tbody>
        </table>
        {error ? <p className="px-4 py-3 text-red-600">{error.message}</p> : null}
      </div>
    </div>
  );
}
