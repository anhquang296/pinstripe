import { PartnerPlatformEnum } from '@vxrerp/billing/contracts';
import type { FastifyInstance } from 'fastify';

import { DEMO_COUNTRY, DEMO_CURRENCY, DEMO_TAX_ID_TYPE } from './demo-catalog';
import { DEMO_OPERATORS } from './demo-operators';
import type { SeededOperator } from './seed-demo.types';

export async function seedOperators(fastify: FastifyInstance): Promise<SeededOperator[]> {
  const seeded: SeededOperator[] = [];

  for (const operator of DEMO_OPERATORS) {
    const customer = await fastify.customerService.createCustomer({
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      description: `Nhà xe ${operator.city}`,
      currency: DEMO_CURRENCY,
      partnerPlatform: PartnerPlatformEnum.VEXERE,
      partnerAccountId: operator.partnerAccountId,
      address: {
        line1: operator.addressLine1,
        city: operator.city,
        country: DEMO_COUNTRY,
      },
    });

    await fastify.taxIdService.createTaxId({
      customerId: customer.id,
      type: DEMO_TAX_ID_TYPE,
      value: operator.taxId,
      country: DEMO_COUNTRY,
    });

    for (const portalUser of operator.portalUsers) {
      await fastify.portalUserService.createPortalMembership({
        customerId: customer.id,
        email: portalUser.email,
        name: portalUser.name,
        role: portalUser.role,
      });
    }

    seeded.push({ operator, customerId: customer.id, subscriptionId: null });
  }

  return seeded;
}
