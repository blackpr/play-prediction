import { CircuitBreakerService } from '../../application/ports/services/circuit-breaker.service';
import { InvariantViolationError, CircuitBreakerOpenError } from '../../domain/errors/domain-error';
import { createRedisClient } from '../redis/connection';
import { DrizzleDB } from '../database';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';

export class RedisCircuitBreakerService implements CircuitBreakerService {
  private redis: Redis;
  private db: DrizzleDB;
  private readonly PRICE_WINDOW_SECONDS = 300; // 5 minutes
  private readonly STATS_WINDOW_MINUTES = 5;
  private readonly ERROR_THRESHOLD = 0.05; // 5%

  // Local state cache
  private isSystemHealthy = true;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 5000; // 5 seconds

  constructor({ db }: { db: DrizzleDB }) {
    this.db = db;
    this.redis = createRedisClient();
  }

  // ... (keeping kInvariant and checkPriceMovement same) ...
  checkKInvariant(kBefore: bigint, kAfter: bigint, marketId: string, operation: string): void {
    if (kAfter < kBefore) {
      const msg = `INVARIANT VIOLATION: k decreased. Market: ${marketId}, Op: ${operation}, Before: ${kBefore}, After: ${kAfter}`;
      console.error(msg);
      throw new InvariantViolationError(
        `k-invariant violated: k decreased from ${kBefore} to ${kAfter}`,
        { marketId, operation, kBefore: kBefore.toString(), kAfter: kAfter.toString() }
      );
    }
  }

  async checkPriceMovement(marketId: string, currentPrice: number): Promise<void> {
    const key = `market:${marketId}:prices`;
    const now = Date.now();

    // Add current price to history first
    await this.redis.zadd(key, now, currentPrice.toString());

    // Clean old prices (older than 5 min)
    const windowStart = now - (this.PRICE_WINDOW_SECONDS * 1000);
    await this.redis.zremrangebyscore(key, 0, windowStart - 1);

    // Get oldest price in window (min score)
    const oldest = await this.redis.zrange(key, 0, 0);

    if (oldest.length > 0) {
      const oldPrice = parseFloat(oldest[0]);
      if (oldPrice > 0) {
        const movement = Math.abs(currentPrice - oldPrice) / oldPrice;

        if (movement > 0.3) {
          const msg = `RAPID PRICE MOVEMENT: ${Math.round(movement * 100)}% on market ${marketId}`;
          console.error(msg);
          throw new CircuitBreakerOpenError(msg);
        }
      }
    }
  }

  async checkSystemHealth(): Promise<void> {
    const now = Date.now();

    // If unhealthy, we only recheck after interval
    if (!this.isSystemHealthy) {
      if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) {
        throw new CircuitBreakerOpenError("System Unstable: Health Check Failed");
      }
    } else {
      // If healthy, we check periodically
      if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) {
        return;
      }
    }

    this.lastHealthCheck = now;

    // 1. Check Database Connectivity
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch (dbErr) {
      this.isSystemHealthy = false;
      console.error('DATABASE CONNECTION FAILED:', dbErr);
      throw new CircuitBreakerOpenError("System Unstable: Database Connectivity Lost");
    }

    // 2. Check Error Rate
    const currentMin = Math.floor(now / 60000);
    const pipeline = this.redis.pipeline();

    for (let i = 0; i < this.STATS_WINDOW_MINUTES; i++) {
      pipeline.get(`stats:req:${currentMin - i}`);
      pipeline.get(`stats:err:${currentMin - i}`);
    }

    const results = await pipeline.exec();

    let totalReq = 0;
    let totalErr = 0;

    if (results) {
      for (let i = 0; i < results.length; i += 2) {
        const [reqErr, reqVal] = results[i];
        const [errErr, errVal] = results[i + 1];

        if (!reqErr && reqVal) totalReq += parseInt(reqVal as string, 10);
        if (!errErr && errVal) totalErr += parseInt(errVal as string, 10);
      }
    }

    if (totalReq > 100) {
      const rate = totalErr / totalReq;
      if (rate > this.ERROR_THRESHOLD) {
        this.isSystemHealthy = false;
        console.error(`HIGH ERROR RATE: ${(rate * 100).toFixed(2)}% (${totalErr}/${totalReq})`);
        throw new CircuitBreakerOpenError(`System Unstable: High Error Rate (${(rate * 100).toFixed(1)}%)`);
      }
    }

    this.isSystemHealthy = true;
  }

  async recordRequest(): Promise<void> {
    const min = Math.floor(Date.now() / 60000);
    const key = `stats:req:${min}`;
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, 600); // 10 min retention
    await multi.exec();
  }

  async recordError(): Promise<void> {
    const min = Math.floor(Date.now() / 60000);
    const key = `stats:err:${min}`;
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, 600);
    await multi.exec();
  }
}
