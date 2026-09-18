import _ from 'lodash';
import { typeid } from 'typeid-js';

export enum ObjectPrefixEnum {
  CUSTOMER = 'cus',
  COUPON = 'coupon',
  PROMOTION_CODE = 'promo',
  DISCOUNT = 'di',
  PRODUCT = 'prod',
  PRICE = 'price',
  SUBSCRIPTION = 'sub',
  SUBSCRIPTION_ITEM = 'si',
  SUBSCRIPTION_ITEM_CHANGE = 'sic',
  SUBSCRIPTION_SCHEDULE = 'sub_sched',
  INVOICE = 'in',
  INVOICE_LINE_ITEM = 'il',
  INVOICE_ITEM = 'ii',
  INVOICE_PAYMENT = 'inpay',
  CREDIT_NOTE = 'cn',
  CUSTOMER_BALANCE_TRANSACTION = 'cbtxn',
  PAYMENT_INTENT = 'pi',
  CHARGE = 'ch',
  REFUND = 're',
  PAYMENT_METHOD = 'pm',
  SETUP_INTENT = 'seti',
  PSP_EVENT = 'pspevt',
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
  TAX_ID = 'txi',
  INVOICE_LINE_TAX_AMOUNT = 'iltx',
  REQUEST = 'req',
  API_KEY = 'ak',
}
export type ObjectPrefix = `${ObjectPrefixEnum}`;

export function generateGid(prefix: ObjectPrefix): string {
  return typeid(prefix).toString();
}

export function hasPrefix(gid: string, prefix: ObjectPrefix): boolean {
  return _.startsWith(gid, `${prefix}_`);
}
