import { customerSchema } from '@contracts/customers.types';
import { couponSchema } from '@contracts/discounts.types';
import { productSchema } from '@contracts/products.types';
import { subscriptionSchema } from '@contracts/subscriptions.types';
import { SubscriptionService } from '@services/subscription.service';
import { Value } from '@sinclair/typebox/value';
import { BadRequestError } from '@vxrerp/platform/errors';
import { ObjectPrefixEnum, resolveGidPrefix } from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const MAX_EXPAND_DEPTH = 4;
const MAX_EXPAND_PATHS = 8;

interface ExpansionTarget {
  idField: string;
  findRelated: (ids: readonly string[]) => Promise<Map<string, unknown>>;
}

type ExpandableObject = Record<string, unknown>;

export class ExpansionService {
  private readonly targetsByPrefix: Record<string, Record<string, ExpansionTarget>>;

  constructor(private readonly fastify: FastifyInstance) {
    const customer: ExpansionTarget = {
      idField: 'customerId',
      findRelated: (ids) => {
        return this.findCustomers(ids);
      },
    };

    const subscription: ExpansionTarget = {
      idField: 'subscriptionId',
      findRelated: (ids) => {
        return this.findSubscriptions(ids);
      },
    };

    const product: ExpansionTarget = {
      idField: 'productId',
      findRelated: (ids) => {
        return this.findProducts(ids);
      },
    };

    const coupon: ExpansionTarget = {
      idField: 'couponId',
      findRelated: (ids) => {
        return this.findCoupons(ids);
      },
    };

    this.targetsByPrefix = {
      [ObjectPrefixEnum.INVOICE]: { customer, subscription },
      [ObjectPrefixEnum.DISCOUNT]: { customer, coupon },
      [ObjectPrefixEnum.PROMOTION_CODE]: { coupon },
      [ObjectPrefixEnum.INVOICE_ITEM]: { customer },
      [ObjectPrefixEnum.TAX_ID]: { customer },
      [ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION]: { customer },
      [ObjectPrefixEnum.SUBSCRIPTION]: { customer },
      [ObjectPrefixEnum.CHECKOUT_SESSION]: { customer },
      [ObjectPrefixEnum.PAYMENT_INTENT]: { customer },
      [ObjectPrefixEnum.REFUND]: { customer },
      [ObjectPrefixEnum.CREDIT_NOTE]: { customer },
      [ObjectPrefixEnum.ENTITLEMENT]: { customer, product },
      [ObjectPrefixEnum.PRICE]: { product },
    };
  }

  async expandResponse<T>(payload: T, expand: readonly string[]): Promise<T> {
    const paths = ExpansionService.parsePaths(expand);

    if (_.isEmpty(paths)) {
      return payload;
    }

    await this.hydrateLevel(ExpansionService.readRoots(payload), paths);

    return payload;
  }

  private async hydrateLevel(
    objects: readonly ExpandableObject[],
    paths: readonly string[][],
  ): Promise<void> {
    if (_.isEmpty(objects)) {
      return;
    }

    const pathsByField = _.groupBy(paths, (path) => {
      return path[0];
    });

    for (const [field, fieldPaths] of _.toPairs(pathsByField)) {
      const children = await this.hydrateField(objects, field);

      const nestedPaths = _.reject(
        _.map(fieldPaths, (path) => {
          return _.drop(path, 1);
        }),
        _.isEmpty,
      );

      await this.hydrateLevel(children, nestedPaths);
    }
  }

  private async hydrateField(
    objects: readonly ExpandableObject[],
    field: string,
  ): Promise<ExpandableObject[]> {
    const target = this.resolveTarget(objects, field);
    const ids = _(objects).map(target.idField).filter(_.isString).uniq().value();

    if (_.isEmpty(ids)) {
      return [];
    }

    const relatedById = await target.findRelated(ids);
    const children: ExpandableObject[] = [];

    for (const object of objects) {
      const id = _.get(object, target.idField);

      if (_.isString(id)) {
        const related = relatedById.get(id) ?? null;

        object[field] = related;

        if (_.isPlainObject(related)) {
          children.push(related as ExpandableObject);
        }
      }
    }

    return children;
  }

  private resolveTarget(objects: readonly ExpandableObject[], field: string): ExpansionTarget {
    const id = _.get(objects, '0.id', '');
    const target = _.get(this.targetsByPrefix, [resolveGidPrefix(String(id)), field], null);

    if (target) {
      return target;
    }

    throw new BadRequestError(`This property cannot be expanded: ${field}`, { param: 'expand' });
  }

  private async findCustomers(ids: readonly string[]): Promise<Map<string, unknown>> {
    const customers = await this.fastify.customerRepository.findCustomers({ ids }, ids.length);

    return new Map(
      _.map(customers, (customer) => {
        return [customer.id, Value.Clean(customerSchema, customer)];
      }),
    );
  }

  private async findCoupons(ids: readonly string[]): Promise<Map<string, unknown>> {
    const coupons = await this.fastify.couponRepository.findCoupons({ ids }, ids.length);

    return new Map(
      _.map(coupons, (coupon) => {
        return [coupon.id, Value.Clean(couponSchema, coupon)];
      }),
    );
  }

  private async findProducts(ids: readonly string[]): Promise<Map<string, unknown>> {
    const products = await this.fastify.productRepository.findProducts({ ids }, ids.length);

    return new Map(
      _.map(products, (product) => {
        return [product.id, Value.Clean(productSchema, product)];
      }),
    );
  }

  private async findSubscriptions(ids: readonly string[]): Promise<Map<string, unknown>> {
    const subscriptions = await this.fastify.subscriptionRepository.findSubscriptions(
      { ids },
      ids.length,
    );

    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: ids,
      deletedAtIsNull: true,
    });

    const itemsBySubscriptionId = _.groupBy(subscriptionItems, 'subscriptionId');

    return new Map(
      _.map(subscriptions, (subscription) => {
        const items = _.get(itemsBySubscriptionId, subscription.id, []);

        const expandedSubscription = SubscriptionService.buildSubscription(subscription, items);

        return [subscription.id, Value.Clean(subscriptionSchema, expandedSubscription)];
      }),
    );
  }

  private static readRoots<T>(payload: T): ExpandableObject[] {
    if (!_.isPlainObject(payload)) {
      return [];
    }

    const root = payload as ExpandableObject;
    const listed = _.get(root, 'data');

    if (_.has(root, 'hasMore') && _.isArray(listed)) {
      return _.filter(listed, _.isPlainObject) as ExpandableObject[];
    }

    return [root];
  }

  private static parsePaths(expand: readonly string[]): string[][] {
    if (expand.length > MAX_EXPAND_PATHS) {
      throw new BadRequestError(`You can expand at most ${MAX_EXPAND_PATHS} paths per request`, {
        param: 'expand',
      });
    }

    return _.map(expand, (path) => {
      const segments = _.reject(_.split(path, '.'), _.isEmpty);

      if (_.isEmpty(segments)) {
        throw new BadRequestError('An expand path cannot be empty', { param: 'expand' });
      }

      if (segments.length > MAX_EXPAND_DEPTH) {
        throw new BadRequestError(
          `An expand path cannot be deeper than ${MAX_EXPAND_DEPTH} levels`,
          { param: 'expand' },
        );
      }

      return segments;
    });
  }
}
