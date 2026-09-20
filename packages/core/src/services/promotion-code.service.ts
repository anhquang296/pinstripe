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

  async createPromotionCode(payload: CreatePromotionCodePayload): Promise<PromotionCodeResponse> {
    const coupon = await this.fastify.couponRepository.getCoupon(payload.couponId);

    if (!coupon.valid) {
      throw new ConflictError(`Coupon ${coupon.id} is no longer valid`);
    }

    if (payload.customerId) {
      await this.fastify.customerService.getCustomer(payload.customerId);
    }

    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.PROMOTION_CODE);
    const {
      code: requestedCode = PromotionCodeService.buildCode(),
      active = true,
      firstTimeTransaction = false,
      metadata = {},
    } = payload;
    const code = _.toUpper(requestedCode);

    try {
      const promotionCode = await this.fastify.promotionCodeRepository.createPromotionCode({
        id,
        code,
        couponId: coupon.id,
        customerId: payload.customerId ?? null,
        active,
        maxRedemptions: payload.maxRedemptions ?? null,
        timesRedeemed: 0,
        expiresAt: payload.expiresAt ?? null,
        firstTimeTransaction,
        minimumAmount: payload.minimumAmount ?? null,
        metadata,
        createdAt: now,
        updatedAt: now,
      });

      if (promotionCode) {
        return promotionCode;
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

  async getPromotionCode(id: string): Promise<PromotionCodeResponse> {
    return this.fastify.promotionCodeRepository.getPromotionCode(id);
  }

  async resolvePromotionCode(code: string): Promise<PromotionCode> {
    const [promotionCode] = await this.fastify.promotionCodeRepository.findPromotionCodes(
      { code: _.toUpper(code) },
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

    if (expiresAt && new Date(expiresAt).getTime() <= at.getTime()) {
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
      { customerId, status: InvoiceStatusEnum.PAID },
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
  ): Promise<PromotionCodeResponse> {
    const existingPromotionCode = await this.fastify.promotionCodeRepository.getPromotionCode(id);
    const { active = existingPromotionCode.active, metadata = existingPromotionCode.metadata } =
      payload;
    const promotionCode = await this.fastify.promotionCodeRepository.updatePromotionCode(id, {
      active,
      metadata,
      updatedAt: this.fastify.clock.now().toISOString(),
    });

    if (promotionCode) {
      return promotionCode;
    }

    throw new NotFoundError(`No such promotion code: ${id}`);
  }

  async findPromotionCodes(
    query: FindPromotionCodesQuery,
  ): Promise<ListResponse<PromotionCodeResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);
    const code = query.code ? _.toUpper(query.code) : undefined;

    const rows = await this.fastify.promotionCodeRepository.findPromotionCodes(
      {
        couponId: query.couponId,
        code,
        active: query.active,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      url: '/v1/promotion_codes',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const promotionCode = await this.fastify.promotionCodeRepository.getPromotionCode(id);

      return { createdAt: promotionCode.createdAt, id: promotionCode.id };
    }

    return undefined;
  }
}
