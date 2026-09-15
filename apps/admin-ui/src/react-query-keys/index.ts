import { mergeQueryKeys } from '@lukemorales/query-key-factory';
import { customerQueries } from '@react-query-keys/customer.keys';
import { entitlementQueries } from '@react-query-keys/entitlement.keys';
import { ledgerQueries } from '@react-query-keys/ledger.keys';
import { priceQueries } from '@react-query-keys/price.keys';
import { productQueries } from '@react-query-keys/product.keys';
import { subscriptionQueries } from '@react-query-keys/subscription.keys';
import { testClockQueries } from '@react-query-keys/test-clock.keys';

export const queries = mergeQueryKeys(
  customerQueries,
  productQueries,
  priceQueries,
  ledgerQueries,
  subscriptionQueries,
  testClockQueries,
  entitlementQueries,
);
