import { OPERATOR_COLLECTION_METHODS } from '@constants/collection';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import type { Customer } from '@database/schemas';
import { BadRequestError } from '@errors/app.error';
import _ from 'lodash';

export function assertCollectionMethodUsable(
  collectionMethod: CollectionMethod,
  customer: Pick<Customer, 'id' | 'vexereOperatorId'>,
): void {
  const isOperatorCollected = _.includes(OPERATOR_COLLECTION_METHODS, collectionMethod);

  if (isOperatorCollected && customer.vexereOperatorId === null) {
    throw new BadRequestError(
      `Customer ${customer.id} has no Vexere operator, so it cannot be collected by ${collectionMethod}`,
      { param: 'collectionMethod' },
    );
  }
}
