import { customType } from 'drizzle-orm/pg-core';

export const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'timestamp with time zone';
  },
  fromDriver(value) {
    return new Date(value).toISOString();
  },
});
