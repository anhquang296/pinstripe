import TestClockForm from '@components/TestClockForm';
import TestClockItem from '@components/TestClockItem';
import { PAGE_LIMIT } from '@constants/pagination';
import type { TestClockFormData } from '@forms/test-clock-form';
import {
  testClockFormDataToPayload,
  testClockFormDefaultValues,
  testClockFormResolver,
} from '@forms/test-clock-form';
import {
  useAdvanceTestClockMutation,
  useCreateTestClockMutation,
  useTestClocksQuery,
} from '@pinstripe/sdk/react';
import { map } from 'lodash-es';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

export default function TestClocksPage() {
  const [advanceTargets, setAdvanceTargets] = useState<Record<string, string>>({});
  const { data: testClocks, error } = useTestClocksQuery(
    { limit: PAGE_LIMIT },
    { hasPlaceholder: true },
  );
  const { mutateAsync: createTestClock, isPending: isSaving } = useCreateTestClockMutation({
    successMessage: 'Đã tạo test clock.',
  });
  const form = useForm<TestClockFormData>({
    resolver: testClockFormResolver,
    defaultValues: testClockFormDefaultValues,
  });
  const { mutate: advanceTestClock } = useAdvanceTestClockMutation({
    successMessage: 'Đã tua đồng hồ.',
  });

  const handleOnSave = form.handleSubmit(async (formData) => {
    await createTestClock(testClockFormDataToPayload(formData));
    form.reset(testClockFormDefaultValues);
  });

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

      <TestClockForm form={form} isSaving={isSaving} onSave={handleOnSave} />

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
            {map(testClocks?.data, (testClock) => {
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
