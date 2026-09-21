import {
  ApiKeyTypeEnum,
  CollectionMethodEnum,
  CurrencyEnum,
  PermissionEnum,
  PORTAL_CLIENT_IP_HEADER,
  PortalRequestKindEnum,
} from '@vxrerp/core/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, buildAuthHeaders, buildTestApp, mintApiKey } from './context';

let fastify: FastifyInstance;
let portalKeyHeaders: Record<string, string>;

beforeAll(async () => {
  fastify = await buildTestApp();

  const portalKey = await mintApiKey(fastify, [PermissionEnum.PORTAL_WRITE], {
    type: ApiKeyTypeEnum.PUBLISHABLE,
  });

  portalKeyHeaders = buildAuthHeaders(portalKey.token);
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(email: string): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    email,
    currency: CurrencyEnum.VND,
    name: 'Portal Tester',
  });

  return customer.id;
}

async function makeSessionHeaders(email: string): Promise<Record<string, string>> {
  await makeCustomer(email);

  const link = await fastify.portalSessionService.createPortalLink({ email });

  const portalSession = await fastify.portalSessionService.redeemPortalLink({
    linkKey: String(link.linkKey),
  });

  return buildAuthHeaders(String(portalSession.sessionKey));
}

describe('portal link surface', () => {
  it('accepts a publishable key and answers the same way for an unknown address', async () => {
    const known = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/links',
      headers: portalKeyHeaders,
      payload: { email: 'known@portal.test' },
    });

    const unknown = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/links',
      headers: portalKeyHeaders,
      payload: { email: 'unknown@portal.test' },
    });

    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(Object.keys(known.json()).sort()).toEqual(Object.keys(unknown.json()).sort());
  });

  it('rejects a secret key that carries no portal permission', async () => {
    const secretKey = await mintApiKey(fastify, [PermissionEnum.BILLING_READ]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/links',
      headers: buildAuthHeaders(secretKey.token),
      payload: { email: 'known@portal.test' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('portal sign-in rate limit', () => {
  it('refuses more link requests for one address than the window allows, whatever the client', async () => {
    const portalKey = await mintApiKey(fastify, [PermissionEnum.PORTAL_WRITE], {
      type: ApiKeyTypeEnum.PUBLISHABLE,
    });

    const headers = buildAuthHeaders(portalKey.token);

    const { portalRateLimit } = fastify.workflowSchedules;

    const statusCodes: number[] = [];

    for (const attempt of _.range(portalRateLimit + 1)) {
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/portal/links',
        headers: { ...headers, [PORTAL_CLIENT_IP_HEADER]: `10.0.0.${attempt}` },
        payload: { email: 'flooded@portal.test' },
      });

      statusCodes.push(response.statusCode);
    }

    expect(_.initial(statusCodes)).toEqual(_.fill(Array(portalRateLimit), 202));
    expect(_.last(statusCodes)).toBe(429);
  });

  it('refuses more session redemptions from one client than the window allows', async () => {
    const portalKey = await mintApiKey(fastify, [PermissionEnum.PORTAL_WRITE], {
      type: ApiKeyTypeEnum.PUBLISHABLE,
    });

    const headers = buildAuthHeaders(portalKey.token);

    const { portalRateLimit } = fastify.workflowSchedules;

    const clientHeaders = { ...headers, [PORTAL_CLIENT_IP_HEADER]: '10.0.1.1' };

    const statusCodes: number[] = [];

    for (const attempt of _.range(portalRateLimit + 1)) {
      const response = await fastify.inject({
        method: 'POST',
        url: '/v1/portal/sessions',
        headers: clientHeaders,
        payload: { linkKey: `guessed-link-key-number-${attempt}` },
      });

      statusCodes.push(response.statusCode);
    }

    const otherClient = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/sessions',
      headers: { ...headers, [PORTAL_CLIENT_IP_HEADER]: '10.0.1.2' },
      payload: { linkKey: 'guessed-link-key-other-client' },
    });

    expect(_.initial(statusCodes)).toEqual(_.fill(Array(portalRateLimit), 401));
    expect(_.last(statusCodes)).toBe(429);
    expect(otherClient.statusCode).toBe(401);
  });
});

describe('portal account surface', () => {
  it('answers /portal/me for the customer behind the session key', async () => {
    const email = 'me@portal.test';
    const headers = await makeSessionHeaders(email);

    const response = await fastify.inject({ method: 'GET', url: '/v1/portal/me', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe(email);
  });

  it('reads only the invoices of the session customer, whatever the query says', async () => {
    const otherCustomerId = await makeCustomer('other@portal.test');
    const headers = await makeSessionHeaders('owner@portal.test');

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/portal/invoices?customerId=${otherCustomerId}`,
      headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('never lists a draft invoice to the customer', async () => {
    const headers = await makeSessionHeaders('drafts@portal.test');
    const me = await fastify.inject({ method: 'GET', url: '/v1/portal/me', headers });
    const customerId = String(me.json().customerId);

    const draftInvoice = await fastify.invoiceService.createInvoice({
      customerId,
      collectionMethod: CollectionMethodEnum.SEND_INVOICE,
      daysUntilDue: 7,
    });

    const issuedDraft = await fastify.invoiceService.createInvoice({
      customerId,
      collectionMethod: CollectionMethodEnum.SEND_INVOICE,
      daysUntilDue: 7,
    });

    const openInvoice = await fastify.invoiceService.finalizeInvoice(issuedDraft.id);

    const response = await fastify.inject({ method: 'GET', url: '/v1/portal/invoices', headers });
    const invoiceIds = _.map(response.json().data, 'id');

    expect(response.statusCode).toBe(200);
    expect(invoiceIds).toContain(openInvoice.id);
    expect(invoiceIds).not.toContain(draftInvoice.id);
  });

  it('answers an empty usage list for a customer with no metered service', async () => {
    const headers = await makeSessionHeaders('usage@portal.test');

    const response = await fastify.inject({ method: 'GET', url: '/v1/portal/usage', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([]);
  });

  it('records a plan change request the operator submits', async () => {
    const headers = await makeSessionHeaders('requests@portal.test');

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/requests',
      headers,
      payload: { kind: PortalRequestKindEnum.PLAN_CHANGE, message: 'Muốn lên gói Pro' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().kind).toBe(PortalRequestKindEnum.PLAN_CHANGE);
  });

  it('refuses a request with an empty message', async () => {
    const headers = await makeSessionHeaders('empty-request@portal.test');

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/requests',
      headers,
      payload: { kind: PortalRequestKindEnum.PROFILE_UPDATE, message: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('compares an invoice with no predecessor against a zero previous total', async () => {
    const headers = await makeSessionHeaders('comparison@portal.test');
    const me = await fastify.inject({ method: 'GET', url: '/v1/portal/me', headers });

    const draft = await fastify.invoiceService.createInvoice({
      customerId: String(me.json().customerId),
      collectionMethod: CollectionMethodEnum.SEND_INVOICE,
      daysUntilDue: 7,
    });

    const invoice = await fastify.invoiceService.finalizeInvoice(draft.id);

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/portal/invoices/${invoice.id}/comparison`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().previousInvoiceId).toBeNull();
    expect(response.json().previousTotal).toBe(0);
  });

  it('answers an empty reminder history for an invoice nobody has been reminded about', async () => {
    const headers = await makeSessionHeaders('reminders@portal.test');
    const me = await fastify.inject({ method: 'GET', url: '/v1/portal/me', headers });

    const draft = await fastify.invoiceService.createInvoice({
      customerId: String(me.json().customerId),
      collectionMethod: CollectionMethodEnum.SEND_INVOICE,
      daysUntilDue: 7,
    });

    const invoice = await fastify.invoiceService.finalizeInvoice(draft.id);

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/portal/invoices/${invoice.id}/reminders`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reminders).toEqual([]);
  });

  it('refuses a comparison for an invoice of another customer', async () => {
    const otherHeaders = await makeSessionHeaders('other-comparison@portal.test');

    const otherMe = await fastify.inject({
      method: 'GET',
      url: '/v1/portal/me',
      headers: otherHeaders,
    });

    const draft = await fastify.invoiceService.createInvoice({
      customerId: String(otherMe.json().customerId),
      collectionMethod: CollectionMethodEnum.SEND_INVOICE,
      daysUntilDue: 7,
    });

    const invoice = await fastify.invoiceService.finalizeInvoice(draft.id);
    const headers = await makeSessionHeaders('intruder-comparison@portal.test');

    const response = await fastify.inject({
      method: 'GET',
      url: `/v1/portal/invoices/${invoice.id}/comparison`,
      headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('refuses a request with no session key', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/v1/portal/me' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a publishable key where a session key belongs', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/portal/me',
      headers: portalKeyHeaders,
    });

    expect(response.statusCode).toBe(401);
  });

  it('stops answering once the session is revoked', async () => {
    const headers = await makeSessionHeaders('logout@portal.test');

    const revoked = await fastify.inject({ method: 'DELETE', url: '/v1/portal/sessions', headers });
    const afterwards = await fastify.inject({ method: 'GET', url: '/v1/portal/me', headers });

    expect(revoked.statusCode).toBe(200);
    expect(afterwards.statusCode).toBe(401);
  });
});

describe('merchant billing portal session', () => {
  it('opens a portal session the customer can use through /v1/portal/me', async () => {
    const email = 'merchant-opened@portal.test';
    const customerId = await makeCustomer(email);
    const secretKey = await mintApiKey(fastify, ALL_PERMISSIONS);

    const created = await fastify.inject({
      method: 'POST',
      url: '/v1/billing_portal/sessions',
      headers: buildAuthHeaders(secretKey.token),
      payload: { customerId },
    });

    const portalUrl = new URL(created.json().url);

    const redeemed = await fastify.inject({
      method: 'POST',
      url: '/v1/portal/sessions',
      headers: portalKeyHeaders,
      payload: { linkKey: String(portalUrl.searchParams.get('linkKey')) },
    });

    const me = await fastify.inject({
      method: 'GET',
      url: '/v1/portal/me',
      headers: buildAuthHeaders(String(redeemed.json().sessionKey)),
    });

    expect(created.statusCode).toBe(201);
    expect(portalUrl.searchParams.has('sessionKey')).toBe(false);
    expect(redeemed.statusCode).toBe(201);
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
  });

  it('refuses a publishable portal key on the merchant route', async () => {
    const customerId = await makeCustomer('merchant-refused@portal.test');

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/billing_portal/sessions',
      headers: portalKeyHeaders,
      payload: { customerId },
    });

    expect(response.statusCode).toBe(403);
  });
});
