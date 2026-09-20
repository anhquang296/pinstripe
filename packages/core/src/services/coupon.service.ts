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
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class CouponService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCoupon(payload: CreateCouponPayload): Promise<CouponResponse> {
    CouponService.assertDiscountKind(payload);
    CouponService.assertDuration(payload);

    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.COUPON);

    const { name = '', appliesToProductIds = [], metadata = {} } = payload;

    const coupon = await this.fastify.couponRepository.createCoupon({
      id,
      name,
      percentOff: payload.percentOff ?? null,
      amountOff: payload.amountOff ?? null,
      currency: payload.currency ?? null,
      duration: payload.duration,
      durationInMonths: payload.durationInMonths ?? null,
      maxRedemptions: payload.maxRedemptions ?? null,
      timesRedeemed: 0,
      redeemBy: payload.redeemBy ?? null,
      appliesToProductIds,
      valid: true,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    if (coupon) {
      return coupon;
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

  async getCoupon(id: string): Promise<CouponResponse> {
    return this.fastify.couponRepository.getCoupon(id);
  }

  async updateCoupon(id: string, payload: UpdateCouponPayload): Promise<CouponResponse> {
    const existingCoupon = await this.fastify.couponRepository.getCoupon(id);

    const { name = existingCoupon.name, metadata = existingCoupon.metadata } = payload;

    const coupon = await this.fastify.couponRepository.updateCoupon(id, {
      name,
      metadata,
      updatedAt: this.fastify.clock.now().toISOString(),
    });

    if (coupon) {
      return coupon;
    }

    throw new NotFoundError(`No such coupon: ${id}`);
  }

  async deleteCoupon(id: string): Promise<DeletedCouponResponse> {
    await this.fastify.couponRepository.getCoupon(id);

    const now = this.fastify.clock.now().toISOString();

    const activeDiscounts = await this.fastify.discountRepository.findDiscounts(
      { couponId: id, activeAt: now },
      1,
    );

    if (_.isEmpty(activeDiscounts)) {
      await this.fastify.couponRepository.archiveCoupon(id, now);

      return { id, deleted: true };
    }

    throw new ConflictError(`Coupon ${id} is still applied to a discount and cannot be deleted`);
  }

  async findCoupons(query: FindCouponsQuery): Promise<ListResponse<CouponResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.couponRepository.findCoupons({ beforeAt, afterAt }, limit + 1);

    return {
      url: '/v1/coupons',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const coupon = await this.fastify.couponRepository.getCoupon(id);

      return { createdAt: coupon.createdAt, id: coupon.id };
    }

    return undefined;
  }
}
