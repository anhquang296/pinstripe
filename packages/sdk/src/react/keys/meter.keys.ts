import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindMetersQuery, GetMeterEventSummaryQuery } from '@type/contracts.types';

export function createMeterQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.METER, {
    meters: (query?: FindMetersQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.billing.meters.find(query);
        },
      };
    },
    meter: (meterId: string) => {
      return {
        queryKey: [meterId],
        queryFn: () => {
          return client.billing.meters.get(meterId);
        },
      };
    },
    eventSummary: (meterId: string, query: GetMeterEventSummaryQuery) => {
      return {
        queryKey: [meterId, query],
        queryFn: () => {
          return client.billing.meters.getEventSummary(meterId, query);
        },
      };
    },
  });
}
