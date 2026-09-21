import { PARTNER_COLLECTION_METHODS } from '@constants/collection';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import type { Customer } from '@database/schemas';
import { BadRequestError } from '@vxrerp/platform/errors';
import _ from 'lodash';

export function assertCollectionMethodUsable(
  collectionMethod: CollectionMethod,
  customer: Pick<Customer, 'id' | 'partnerAccountId'>,
): void {
  const isPartnerCollected = _.includes(PARTNER_COLLECTION_METHODS, collectionMethod);

  if (isPartnerCollected && customer.partnerAccountId === null) {
    throw new BadRequestError(
      `Customer ${customer.id} has no partner account, so it cannot be collected by ${collectionMethod}`,
      { param: 'collectionMethod' },
    );
  }
}
