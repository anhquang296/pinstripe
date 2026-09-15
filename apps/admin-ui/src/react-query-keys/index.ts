import { mergeQueryKeys } from '@lukemorales/query-key-factory';
import { customerQueries } from '@react-query-keys/customer.keys';
import { ledgerQueries } from '@react-query-keys/ledger.keys';
import { priceQueries } from '@react-query-keys/price.keys';
import { productQueries } from '@react-query-keys/product.keys';

export const queries = mergeQueryKeys(customerQueries, productQueries, priceQueries, ledgerQueries);
