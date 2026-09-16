import _ from 'lodash';
import { typeid } from 'typeid-js';

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
  WEBHOOK_DELIVERY = 'wd',
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

export function generateGid(prefix: ObjectPrefix): string {
  return typeid(prefix).toString();
}

export function hasPrefix(gid: string, prefix: ObjectPrefix): boolean {
  return _.startsWith(gid, `${prefix}_`);
}
