import type { GetMeterEventSummariesQuery, GetMetersQuery } from '@api/meters';
import { getMeter, getMeterEventSummary, getMeters } from '@api/meters';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const meterQueries = createQueryKeys(ReactQuerySubjectEnum.METER, {
  meters: (query?: GetMetersQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getMeters(query);
      },
    };
  },
  meter: (meterId: string) => {
    return {
      queryKey: [meterId],
      queryFn: () => {
        return getMeter(meterId);
      },
    };
  },
  eventSummary: (meterId: string, query: GetMeterEventSummariesQuery) => {
    return {
      queryKey: [meterId, query],
      queryFn: () => {
        return getMeterEventSummary(meterId, query);
      },
    };
  },
});
