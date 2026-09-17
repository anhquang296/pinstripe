import type {
  CreatePromotionCodePayload,
  FindPromotionCodesQuery,
  PromotionCodeResponse,
  UpdatePromotionCodePayload,
} from '@contracts/discounts.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { PromotionCode } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const GENERATED_CODE_LENGTH = 10;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class PromotionCodeService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPromotionCode(
    payload: CreatePromotionCodePayload,
    livemode: boolean,
  ): Promise<PromotionCodeResponse> {
    const coupon = await this.fastify.couponService.getCouponEntity(payload.couponId, livemode);

    if (!coupon.valid) {
      throw new ConflictError(`Coupon ${coupon.id} is no longer valid`);
    }

    if (payload.customerId) {
      await this.fastify.customerService.getCustomer(payload.customerId, livemode);
    }

    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.PROMOTION_CODE);
    const code = _.toUpper(payload.code ?? PromotionCodeService.buildCode());

    try {
      const promotionCode = await this.fastify.promotionCodeRepository.createPromotionCode({
        id,
        livemode,
        code,
        couponId: coupon.id,
        customerId: payload.customerId ?? null,
        active: payload.active ?? true,
        maxRedemptions: payload.maxRedemptions ?? null,
        timesRedeemed: 0,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        firstTimeTransaction: payload.firstTimeTransaction ?? false,
        minimumAmount: payload.minimumAmount ?? null,
        metadata: payload.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      });

      if (promotionCode) {
        return PromotionCodeService.buildPromotionCode(promotionCode);
      }

      throw new NotFoundError(`Promotion code ${id} could not be created`);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Promotion code ${code} is already taken`);
      }

      throw error;
    }
  }

  private static buildCode(): string {
    return _(_.range(GENERATED_CODE_LENGTH))
      .map(() => {
        return CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
      })
      .join('');
  }

  async getPromotionCode(id: string, livemode: boolean): Promise<PromotionCodeResponse> {
    const promotionCode = await this.getPromotionCodeEntity(id, livemode);

    return PromotionCodeService.buildPromotionCode(promotionCode);
  }

  async getPromotionCodeEntity(id: string, livemode: boolean): Promise<PromotionCode> {
    const promotionCode = await this.fastify.promotionCodeRepository.findPromotionCode(id);

    if (promotionCode && promotionCode.livemode === livemode) {
      return promotionCode;
    }

    throw new NotFoundError(`No such promotion code: ${id}`);
  }

  async resolvePromotionCode(code: string, livemode: boolean): Promise<PromotionCode> {
    const [promotionCode] = await this.fastify.promotionCodeRepository.findPromotionCodes(
      { livemode, code: _.toUpper(code) },
      1,
    );

    if (promotionCode) {
      return promotionCode;
    }

    throw new NotFoundError(`No such promotion code: ${code}`);
  }

  async redeemPromotionCode(
    promotionCode: PromotionCode,
    customerId: string,
    at: Date,
  ): Promise<PromotionCode> {
    await this.assertRestrictions(promotionCode, customerId, at);

    const redeemed = await this.fastify.promotionCodeRepository.redeemPromotionCode(
      promotionCode.id,
    );

    if (redeemed) {
      return redeemed;
    }

    throw new ConflictError(
      `Promotion code ${promotionCode.code} is inactive or has run out of redemptions`,
    );
  }

  private async assertRestrictions(
    promotionCode: PromotionCode,
    customerId: string,
    at: Date,
  ): Promise<void> {
    const { expiresAt, customerId: restrictedCustomerId } = promotionCode;

    if (expiresAt && expiresAt.getTime() <= at.getTime()) {
      throw new ConflictError(`Promotion code ${promotionCode.code} has expired`);
    }

    if (restrictedCustomerId && restrictedCustomerId !== customerId) {
      throw new BadRequestError(
        `Promotion code ${promotionCode.code} belongs to another customer`,
        { param: 'promotionCode' },
      );
    }

    if (promotionCode.firstTimeTransaction) {
      await this.assertFirstTimeTransaction(promotionCode, customerId);
    }
  }

  private async assertFirstTimeTransaction(
    promotionCode: PromotionCode,
    customerId: string,
  ): Promise<void> {
    const paidInvoices = await this.fastify.invoiceRepository.findInvoices(
      { livemode: promotionCode.livemode, customerId, status: InvoiceStatusEnum.PAID },
      1,
    );

    if (_.isEmpty(paidInvoices)) {
      return;
    }

    throw new ConflictError(
      `Promotion code ${promotionCode.code} is limited to a customer's first transaction`,
    );
  }

  async updatePromotionCode(
    id: string,
    payload: UpdatePromotionCodePayload,
    livemode: boolean,
  ): Promise<PromotionCodeResponse> {
    const existingPromotionCode = await this.getPromotionCodeEntity(id, livemode);
    const now = this.fastify.clock.now();

    const promotionCode = await this.fastify.promotionCodeRepository.updatePromotionCode(id, {
      active: payload.active ?? existingPromotionCode.active,
      metadata: payload.metadata ?? existingPromotionCode.metadata,
      updatedAt: now,
    });

    if (promotionCode) {
      return PromotionCodeService.buildPromotionCode(promotionCode);
    }

    throw new NotFoundError(`No such promotion code: ${id}`);
  }

  async findPromotionCodes(
    query: FindPromotionCodesQuery,
    livemode: boolean,
  ): Promise<ListResponse<PromotionCodeResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter, livemode);
    const afterAt = await this.resolveCursor(query.endingBefore, livemode);

    const rows = await this.fastify.promotionCodeRepository.findPromotionCodes(
      {
        livemode,
        couponId: query.couponId,
        code: query.code ? _.toUpper(query.code) : undefined,
        active: query.active,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/promotion_codes',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(PromotionCodeService.buildPromotionCode).value(),
    };
  }

  private async resolveCursor(
    id: string | undefined,
    livemode: boolean,
  ): Promise<RowCursor | undefined> {
    if (id) {
      const promotionCode = await this.getPromotionCodeEntity(id, livemode);

      return { createdAt: promotionCode.createdAt, id: promotionCode.id };
    }

    return undefined;
  }

  static buildPromotionCode(entity: PromotionCode): PromotionCodeResponse {
    return {
      object: 'promotion_code',
      id: entity.id,
      livemode: entity.livemode,
      code: entity.code,
      couponId: entity.couponId,
      customerId: entity.customerId,
      active: entity.active,
      maxRedemptions: entity.maxRedemptions,
      timesRedeemed: entity.timesRedeemed,
      expiresAt: entity.expiresAt ? entity.expiresAt.toISOString() : null,
      firstTimeTransaction: entity.firstTimeTransaction,
      minimumAmount: entity.minimumAmount,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
