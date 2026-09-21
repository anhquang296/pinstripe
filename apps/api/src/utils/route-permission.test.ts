import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PermissionEnum } from '@vxrerp/platform/contracts';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';

import { resolveOperationPermission } from './route-permission';

interface OpenApiSpec {
  paths: Record<string, Record<string, { operationId?: string }>>;
}

const SPEC_PATH = fileURLToPath(new URL('../../openapi.json', import.meta.url));

function readSpecOperationIds(): string[] {
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as OpenApiSpec;

  return _(spec.paths)
    .values()
    .flatMap((operations) => {
      return _.values(operations);
    })
    .map('operationId')
    .compact()
    .value();
}

describe('resolveOperationPermission', () => {
  it.each([
    { operationId: 'customers.find', expected: PermissionEnum.BILLING_READ },
    { operationId: 'invoices.getUpcoming', expected: PermissionEnum.BILLING_READ },
    { operationId: 'billing.meters.getEventSummary', expected: PermissionEnum.BILLING_READ },
    { operationId: 'customers.findBalanceTransactions', expected: PermissionEnum.BILLING_READ },
    { operationId: 'customers.create', expected: PermissionEnum.CUSTOMER_WRITE },
    { operationId: 'customers.delete', expected: PermissionEnum.CUSTOMER_DELETE },
    { operationId: 'invoices.finalize', expected: PermissionEnum.INVOICE_WRITE },
    { operationId: 'invoices.void', expected: PermissionEnum.INVOICE_VOID },
    { operationId: 'creditNotes.void', expected: PermissionEnum.CREDIT_NOTE_WRITE },
    { operationId: 'billing.meters.create', expected: PermissionEnum.CATALOG_WRITE },
    { operationId: 'checkout.sessions.create', expected: PermissionEnum.SUBSCRIPTION_WRITE },
    { operationId: 'paymentIntents.capture', expected: PermissionEnum.REFUND_WRITE },
    { operationId: 'webhookDeliveries.replay', expected: PermissionEnum.INTEGRATION_WRITE },
    { operationId: 'testHelpers.testClocks.advance', expected: PermissionEnum.TEST_CLOCK_WRITE },
  ])('resolves $operationId to $expected', ({ operationId, expected }) => {
    const permission = resolveOperationPermission(operationId);

    expect(permission).toBe(expected);
  });

  it('resolves to null for a resource the table does not know', () => {
    const permission = resolveOperationPermission('mysteries.create');

    expect(permission).toBeNull();
  });

  it('resolves to null for an operation id that carries no resource', () => {
    const permission = resolveOperationPermission('ping');

    expect(permission).toBeNull();
  });

  it('resolves a permission for every operation id in the published spec', () => {
    const operationIds = readSpecOperationIds();

    const unmappedOperationIds = _.reject(operationIds, (operationId) => {
      return Boolean(resolveOperationPermission(operationId));
    });

    expect(operationIds.length).toBeGreaterThan(0);
    expect(unmappedOperationIds).toEqual([]);
  });
});
