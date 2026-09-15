import { randomBytes } from 'node:crypto';

import _ from 'lodash';

export enum ObjectPrefixEnum {
  CUSTOMER = 'cus',
  PRODUCT = 'prod',
  PRICE = 'price',
  SUBSCRIPTION = 'sub',
  SUBSCRIPTION_ITEM = 'si',
  SUBSCRIPTION_SCHEDULE = 'sub_sched',
  INVOICE = 'in',
  INVOICE_LINE_ITEM = 'il',
  CREDIT_NOTE = 'cn',
  PAYMENT_INTENT = 'pi',
  CHARGE = 'ch',
  REFUND = 're',
  PAYMENT_METHOD = 'pm',
  EVENT = 'evt',
  WEBHOOK_ENDPOINT = 'we',
  METER = 'mtr',
  METER_EVENT = 'mtrevt',
  LEDGER_ACCOUNT = 'lacct',
  LEDGER_TRANSACTION = 'ltxn',
  LEDGER_POSTING = 'lpost',
  ENTITLEMENT = 'ent',
  TEST_CLOCK = 'clock',
  TAX_RATE = 'txr',
  REQUEST = 'req',
}
export type ObjectPrefix = `${ObjectPrefixEnum}`;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ID_BODY_LENGTH = 24;

export function generateId(prefix: ObjectPrefix): string {
  const bytes = randomBytes(ID_BODY_LENGTH);
  let body = '';

  for (const byte of bytes) {
    body += BASE58_ALPHABET[byte % BASE58_ALPHABET.length];
  }

  return `${prefix}_${body}`;
}

export function hasPrefix(id: string, prefix: ObjectPrefix): boolean {
  return _.startsWith(id, `${prefix}_`);
}
