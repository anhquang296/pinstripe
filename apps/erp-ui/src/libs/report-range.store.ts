import type { ReportRange, ReportRangePreset } from '@common/utils/report-range';
import { ReportRangePresetEnum } from '@common/utils/report-range';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReportRangeState extends ReportRange {
  setPreset: (preset: ReportRangePreset) => void;
  setCustomRange: (fromDate: string, toDate: string) => void;
}

export const useReportRangeStore = create<ReportRangeState>()(
  persist(
    (set) => {
      return {
        preset: ReportRangePresetEnum.LAST_30_DAYS,
        fromDate: null,
        toDate: null,
        setPreset: (preset) => {
          return set({ preset });
        },
        setCustomRange: (fromDate, toDate) => {
          return set({ preset: ReportRangePresetEnum.CUSTOM, fromDate, toDate });
        },
      };
    },
    {
      name: 'vxrerp-report-range',
      partialize: (state) => {
        const { preset, fromDate, toDate } = state;

        return { preset, fromDate, toDate };
      },
    },
  ),
);
