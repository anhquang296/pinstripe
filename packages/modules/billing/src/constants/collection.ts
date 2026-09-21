import type { CollectionMethod } from '@contracts/subscriptions.types';
import { CollectionMethodEnum } from '@contracts/subscriptions.types';

export const PARTNER_COLLECTION_METHODS: readonly CollectionMethod[] = [
  CollectionMethodEnum.OFFSET_TICKET,
  CollectionMethodEnum.DEBIT_WALLET,
];

export const AUTOMATIC_COLLECTION_METHODS: readonly CollectionMethod[] = [
  CollectionMethodEnum.CHARGE_AUTOMATICALLY,
  ...PARTNER_COLLECTION_METHODS,
];
