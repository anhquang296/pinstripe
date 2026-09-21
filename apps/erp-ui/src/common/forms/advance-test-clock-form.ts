import { zodResolver } from '@hookform/resolvers/zod';
import type { AdvanceTestClockPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const advanceTestClockFormSchema = z.object({
  frozenTime: z.string().min(1, 'Chọn mốc thời gian muốn tua tới'),
});

export type AdvanceTestClockFormData = z.infer<typeof advanceTestClockFormSchema>;

export const advanceTestClockFormResolver = zodResolver(advanceTestClockFormSchema);

export const advanceTestClockFormDefaultValues: AdvanceTestClockFormData = {
  frozenTime: '',
};

export function advanceTestClockFormDataToPayload(
  formData: AdvanceTestClockFormData,
): AdvanceTestClockPayload {
  return {
    frozenTime: new Date(formData.frozenTime).toISOString(),
  };
}
