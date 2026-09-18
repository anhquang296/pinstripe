import { BadRequestError } from '@errors/app.error';
import { CouponService } from '@services/coupon.service';
import { CustomerService } from '@services/customer.service';
import { ProductService } from '@services/product.service';
import { SubscriptionService } from '@services/subscription.service';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const MAX_EXPAND_DEPTH = 4;
const MAX_EXPAND_PATHS = 8;

interface ExpansionTarget {
  idField: string;
  findRelated: (ids: readonly string[], livemode: boolean) => Promise<Map<string, unknown>>;
}

type ExpandableObject = Record<string, unknown>;

export class ExpansionService {
  private readonly targetsByObject: Record<string, Record<string, ExpansionTarget>>;

  constructor(private readonly fastify: FastifyInstance) {
    const customer: ExpansionTarget = {
      idField: 'customerId',
      findRelated: (ids, livemode) => {
        return this.findCustomers(ids, livemode);
      },
    };

    const subscription: ExpansionTarget = {
      idField: 'subscriptionId',
      findRelated: (ids, livemode) => {
        return this.findSubscriptions(ids, livemode);
      },
    };

    const product: ExpansionTarget = {
      idField: 'productId',
      findRelated: (ids, livemode) => {
        return this.findProducts(ids, livemode);
      },
    };

    const coupon: ExpansionTarget = {
      idField: 'couponId',
      findRelated: (ids, livemode) => {
        return this.findCoupons(ids, livemode);
      },
    };

    this.targetsByObject = {
      invoice: { customer, subscription },
      discount: { customer, coupon },
      promotion_code: { coupon },
      invoiceitem: { customer },
      tax_id: { customer },
      customer_balance_transaction: { customer },
      subscription: { customer },
      payment_intent: { customer },
      refund: { customer },
      credit_note: { customer },
      entitlement: { customer, product },
      price: { product },
    };
  }

  async expandResponse<T>(payload: T, expand: readonly string[], livemode: boolean): Promise<T> {
    const paths = ExpansionService.parsePaths(expand);

    if (_.isEmpty(paths)) {
      return payload;
    }

    await this.hydrateLevel(ExpansionService.readRoots(payload), paths, livemode);

    return payload;
  }

  private async hydrateLevel(
    objects: readonly ExpandableObject[],
    paths: readonly string[][],
    livemode: boolean,
  ): Promise<void> {
    if (_.isEmpty(objects)) {
      return;
    }

    const pathsByField = _.groupBy(paths, (path) => {
      return path[0];
    });

    for (const [field, fieldPaths] of _.toPairs(pathsByField)) {
      const children = await this.hydrateField(objects, field, livemode);

      const nestedPaths = _.reject(
        _.map(fieldPaths, (path) => {
          return _.drop(path, 1);
        }),
        _.isEmpty,
      );

      await this.hydrateLevel(children, nestedPaths, livemode);
    }
  }

  private async hydrateField(
    objects: readonly ExpandableObject[],
    field: string,
    livemode: boolean,
  ): Promise<ExpandableObject[]> {
    const target = this.resolveTarget(objects, field);
    const ids = _(objects).map(target.idField).filter(_.isString).uniq().value();

    if (_.isEmpty(ids)) {
      return [];
    }

    const relatedById = await target.findRelated(ids, livemode);
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
    const objectType = _.get(objects, '0.object', '');
    const target = _.get(this.targetsByObject, [String(objectType), field], null);

    if (target) {
      return target;
    }

    throw new BadRequestError(`This property cannot be expanded: ${field}`, { param: 'expand' });
  }

  private async findCustomers(
    ids: readonly string[],
    livemode: boolean,
  ): Promise<Map<string, unknown>> {
    const customers = await this.fastify.customerRepository.findCustomers(
      { ids, livemode },
      ids.length,
    );

    return new Map(
      _.map(customers, (customer) => {
        return [customer.id, CustomerService.buildCustomer(customer)];
      }),
    );
  }

  private async findCoupons(
    ids: readonly string[],
    livemode: boolean,
  ): Promise<Map<string, unknown>> {
    const coupons = await this.fastify.couponRepository.findCoupons({ ids, livemode }, ids.length);

    return new Map(
      _.map(coupons, (coupon) => {
        return [coupon.id, CouponService.buildCoupon(coupon)];
      }),
    );
  }

  private async findProducts(
    ids: readonly string[],
    livemode: boolean,
  ): Promise<Map<string, unknown>> {
    const products = await this.fastify.productRepository.findProducts(
      { ids, livemode },
      ids.length,
    );

    return new Map(
      _.map(products, (product) => {
        return [product.id, ProductService.buildProduct(product)];
      }),
    );
  }

  private async findSubscriptions(
    ids: readonly string[],
    livemode: boolean,
  ): Promise<Map<string, unknown>> {
    const subscriptions = await this.fastify.subscriptionRepository.findSubscriptions(
      { ids, livemode },
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

        return [subscription.id, SubscriptionService.buildSubscription(subscription, items)];
      }),
    );
  }

  private static readRoots<T>(payload: T): ExpandableObject[] {
    if (!_.isPlainObject(payload)) {
      return [];
    }

    const root = payload as ExpandableObject;
    const listed = _.get(root, 'data');

    if (_.get(root, 'object') === 'list' && _.isArray(listed)) {
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
