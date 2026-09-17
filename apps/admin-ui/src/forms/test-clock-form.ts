import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateTestClockPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const testClockFormSchema = z.object({
  name: z.string().min(1, 'Tên đồng hồ là bắt buộc'),
});

export type TestClockFormData = z.infer<typeof testClockFormSchema>;

export const testClockFormResolver = zodResolver(testClockFormSchema);

export const testClockFormDefaultValues: TestClockFormData = {
  name: '',
};

export function testClockFormDataToPayload(formData: TestClockFormData): CreateTestClockPayload {
  return {
    name: formData.name,
    frozenTime: new Date().toISOString(),
  };
}
