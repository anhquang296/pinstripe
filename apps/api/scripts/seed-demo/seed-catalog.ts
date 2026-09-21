import type { CouponResponse, PromotionCodeResponse } from '@vxrerp/core/contracts';
import { CouponDurationEnum, TaxTypeEnum } from '@vxrerp/core/contracts';
import type { FastifyInstance } from 'fastify';

import type { DemoMeterKey, DemoPriceKey, DemoProductKey } from './demo-catalog';
import {
  DEMO_COUPON,
  DEMO_CURRENCY,
  DEMO_METERS,
  DEMO_PRICES,
  DEMO_PRODUCTS,
  DEMO_PROMOTION_CODE,
  DEMO_RECURRING,
  DEMO_TAX_BEHAVIOR,
  DEMO_TAX_RATE,
  DEMO_TIERS_MODE,
} from './demo-catalog';
import type { SeededCatalog } from './seed-demo.types';

export async function seedCatalog(fastify: FastifyInstance): Promise<SeededCatalog> {
  const meterIdByKey = {} as Record<DemoMeterKey, string>;

  for (const meter of DEMO_METERS) {
    const createdMeter = await fastify.meterService.createMeter({
      displayName: meter.displayName,
      eventName: meter.eventName,
      aggregation: meter.aggregation,
      valueKey: meter.valueKey,
    });

    meterIdByKey[meter.key] = createdMeter.id;
  }

  const productIdByKey = {} as Record<DemoProductKey, string>;

  for (const product of DEMO_PRODUCTS) {
    const createdProduct = await fastify.productService.createProduct({
      name: product.name,
      description: product.description,
      unitLabel: product.unitLabel,
    });

    productIdByKey[product.key] = createdProduct.id;
  }

  const priceIdByKey = {} as Record<DemoPriceKey, string>;

  for (const price of DEMO_PRICES) {
    const createdPrice = await fastify.priceService.createPrice({
      productId: productIdByKey[price.productKey],
      lookupKey: price.lookupKey,
      nickname: price.nickname,
      currency: DEMO_CURRENCY,
      billingScheme: price.billingScheme,
      taxBehavior: DEMO_TAX_BEHAVIOR,
      unitAmount: price.unitAmount,
      tiersMode: price.tiers ? DEMO_TIERS_MODE : undefined,
      tiers: price.tiers,
      meterId: price.meterKey ? meterIdByKey[price.meterKey] : undefined,
      recurring: {
        interval: DEMO_RECURRING.interval,
        intervalCount: DEMO_RECURRING.intervalCount,
        usageType: price.usageType,
      },
    });

    priceIdByKey[price.key] = createdPrice.id;
  }

  const taxRate = await fastify.taxRateService.createTaxRate({
    displayName: DEMO_TAX_RATE.displayName,
    description: DEMO_TAX_RATE.description,
    percentage: DEMO_TAX_RATE.percentage,
    inclusive: DEMO_TAX_RATE.inclusive,
    taxType: TaxTypeEnum.VAT,
    jurisdiction: DEMO_TAX_RATE.jurisdiction,
    country: DEMO_TAX_RATE.country,
  });

  await seedPromotion(fastify);

  return { productIdByKey, priceIdByKey, meterIdByKey, taxRateId: taxRate.id };
}

async function seedPromotion(fastify: FastifyInstance): Promise<PromotionCodeResponse> {
  const coupon: CouponResponse = await fastify.couponService.createCoupon({
    name: DEMO_COUPON.name,
    percentOff: DEMO_COUPON.percentOff,
    duration: CouponDurationEnum.REPEATING,
    durationInMonths: DEMO_COUPON.durationInMonths,
  });

  return fastify.promotionCodeService.createPromotionCode({
    couponId: coupon.id,
    code: DEMO_PROMOTION_CODE,
  });
}
