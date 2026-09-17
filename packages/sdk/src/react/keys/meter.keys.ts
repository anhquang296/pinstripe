import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetMeterEventSummariesQuery, GetMetersQuery } from '@type/contracts.types';

export function createMeterQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.METER, {
    meters: (query?: GetMetersQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.billing.meters.list(query);
        },
      };
    },
    meter: (meterId: string) => {
      return {
        queryKey: [meterId],
        queryFn: () => {
          return client.billing.meters.retrieve(meterId);
        },
      };
    },
    eventSummary: (meterId: string, query: GetMeterEventSummariesQuery) => {
      return {
        queryKey: [meterId, query],
        queryFn: () => {
          return client.billing.meters.retrieveEventSummary(meterId, query);
        },
      };
    },
  });
}
