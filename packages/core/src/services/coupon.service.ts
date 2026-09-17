import type {
  CouponResponse,
  CreateCouponPayload,
  DeletedCouponResponse,
  FindCouponsQuery,
  UpdateCouponPayload,
} from '@contracts/discounts.types';
import { CouponDurationEnum } from '@contracts/discounts.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { Coupon } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class CouponService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCoupon(payload: CreateCouponPayload, livemode: boolean): Promise<CouponResponse> {
    CouponService.assertDiscountKind(payload);
    CouponService.assertDuration(payload);

    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.COUPON);

    const coupon = await this.fastify.couponRepository.createCoupon({
      id,
      livemode,
      name: payload.name ?? '',
      percentOff: payload.percentOff ?? null,
      amountOff: payload.amountOff ?? null,
      currency: payload.currency ?? null,
      duration: payload.duration,
      durationInMonths: payload.durationInMonths ?? null,
      maxRedemptions: payload.maxRedemptions ?? null,
      timesRedeemed: 0,
      redeemBy: payload.redeemBy ? new Date(payload.redeemBy) : null,
      appliesToProductIds: payload.appliesToProductIds ?? [],
      valid: true,
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    if (coupon) {
      return CouponService.buildCoupon(coupon);
    }

    throw new NotFoundError(`Coupon ${id} could not be created`);
  }

  private static assertDiscountKind(payload: CreateCouponPayload): void {
    const hasPercentOff = payload.percentOff !== undefined;
    const hasAmountOff = payload.amountOff !== undefined;

    if (hasPercentOff === hasAmountOff) {
      throw new BadRequestError('A coupon takes either a percent off or an amount off', {
        param: 'percentOff',
      });
    }

    if (hasAmountOff && !payload.currency) {
      throw new BadRequestError('A coupon with an amount off needs a currency', {
        param: 'currency',
      });
    }
  }

  private static assertDuration(payload: CreateCouponPayload): void {
    const isRepeating = payload.duration === CouponDurationEnum.REPEATING;
    const hasDurationInMonths = payload.durationInMonths !== undefined;

    if (isRepeating === hasDurationInMonths) {
      return;
    }

    if (isRepeating) {
      throw new BadRequestError('A repeating coupon needs a duration in months', {
        param: 'durationInMonths',
      });
    }

    throw new BadRequestError(`A ${payload.duration} coupon does not take a duration in months`, {
      param: 'durationInMonths',
    });
  }

  async getCoupon(id: string, livemode: boolean): Promise<CouponResponse> {
    const coupon = await this.getCouponEntity(id, livemode);

    return CouponService.buildCoupon(coupon);
  }

  async getCouponEntity(id: string, livemode: boolean): Promise<Coupon> {
    const coupon = await this.fastify.couponRepository.findCoupon(id);

    if (coupon && coupon.livemode === livemode) {
      return coupon;
    }

    throw new NotFoundError(`No such coupon: ${id}`);
  }

  async updateCoupon(
    id: string,
    payload: UpdateCouponPayload,
    livemode: boolean,
  ): Promise<CouponResponse> {
    const existingCoupon = await this.getCouponEntity(id, livemode);
    const now = this.fastify.clock.now();

    const coupon = await this.fastify.couponRepository.updateCoupon(id, {
      name: payload.name ?? existingCoupon.name,
      metadata: payload.metadata ?? existingCoupon.metadata,
      updatedAt: now,
    });

    if (coupon) {
      return CouponService.buildCoupon(coupon);
    }

    throw new NotFoundError(`No such coupon: ${id}`);
  }

  async deleteCoupon(id: string, livemode: boolean): Promise<DeletedCouponResponse> {
    await this.getCouponEntity(id, livemode);

    const activeDiscounts = await this.fastify.discountRepository.findDiscounts(
      { livemode, couponId: id, activeAt: this.fastify.clock.now() },
      1,
    );

    if (_.isEmpty(activeDiscounts)) {
      await this.fastify.couponRepository.archiveCoupon(id, this.fastify.clock.now());

      return { object: 'coupon', id, deleted: true };
    }

    throw new ConflictError(`Coupon ${id} is still applied to a discount and cannot be deleted`);
  }

  async findCoupons(
    query: FindCouponsQuery,
    livemode: boolean,
  ): Promise<ListResponse<CouponResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter, livemode);
    const afterAt = await this.resolveCursor(query.endingBefore, livemode);

    const rows = await this.fastify.couponRepository.findCoupons(
      { livemode, beforeAt, afterAt },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/coupons',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(CouponService.buildCoupon).value(),
    };
  }

  private async resolveCursor(
    id: string | undefined,
    livemode: boolean,
  ): Promise<RowCursor | undefined> {
    if (id) {
      const coupon = await this.getCouponEntity(id, livemode);

      return { createdAt: coupon.createdAt, id: coupon.id };
    }

    return undefined;
  }

  static buildCoupon(entity: Coupon): CouponResponse {
    return {
      object: 'coupon',
      id: entity.id,
      livemode: entity.livemode,
      name: entity.name,
      percentOff: entity.percentOff,
      amountOff: entity.amountOff,
      currency: entity.currency,
      duration: entity.duration,
      durationInMonths: entity.durationInMonths,
      maxRedemptions: entity.maxRedemptions,
      timesRedeemed: entity.timesRedeemed,
      redeemBy: entity.redeemBy ? entity.redeemBy.toISOString() : null,
      appliesToProductIds: entity.appliesToProductIds,
      valid: entity.valid,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
