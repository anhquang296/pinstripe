export enum RedisNamespaceEnum {
  IDEMPOTENCY = 'idempotency',
  METER_DEDUP = 'meter-dedup',
  ENTITLEMENT = 'entitlement',
  BILLING_RUN_LOCK = 'billing-run-lock',
  API_RATE_LIMIT = 'api-rate-limit',
  WEBHOOK_RATE_LIMIT = 'webhook-rate-limit',
}
export type RedisNamespace = `${RedisNamespaceEnum}`;

const KEY_SEPARATOR = ':';

export class RedisKeyFactory {
  constructor(private readonly prefix: string) {}

  build(namespace: RedisNamespace, ...parts: readonly string[]): string {
    return [this.prefix, namespace, ...parts].join(KEY_SEPARATOR);
  }
}
