import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateTestClockPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const testClockFormSchema = z.object({
  name: z.string().min(1, 'Tên đồng hồ là bắt buộc'),
  frozenTime: z.string(),
});

export type TestClockFormData = z.infer<typeof testClockFormSchema>;

export const testClockFormResolver = zodResolver(testClockFormSchema);

export const testClockFormDefaultValues: TestClockFormData = {
  name: '',
  frozenTime: '',
};

export function testClockFormDataToPayload(formData: TestClockFormData): CreateTestClockPayload {
  const { frozenTime } = formData;

  if (frozenTime) {
    return { name: formData.name, frozenTime: new Date(frozenTime).toISOString() };
  }

  return { name: formData.name, frozenTime: new Date().toISOString() };
}
