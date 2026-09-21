import type { Redis } from 'ioredis';

export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export async function consumeRateLimit(
  redis: Redis,
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const used = await redis.incr(key);

  if (used === 1) {
    await redis.expire(key, policy.windowSeconds);
  }

  const ttl = await redis.ttl(key);
  const resetSeconds = ttl > 0 ? ttl : policy.windowSeconds;

  return {
    isAllowed: used <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(policy.limit - used, 0),
    resetSeconds,
  };
}
