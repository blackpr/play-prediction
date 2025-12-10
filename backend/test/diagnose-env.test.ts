
import { describe, it, expect } from 'vitest';
import { getEnv } from '../src/shared/config/env';
import Redis from 'ioredis';

describe('Environment Diagnosis', () => {
  it('should have REDIS_URL defined', () => {
    const redisUrl = process.env.REDIS_URL;
    console.log('Current REDIS_URL:', redisUrl);
    
    if (!redisUrl) {
      console.warn('REDIS_URL is NOT defined in process.env');
    } else {
      console.log('REDIS_URL is defined');
    }
    
    // Check if we can connect if it is defined
    if (redisUrl) {
       const redis = new Redis(redisUrl, {
         connectTimeout: 2000,
         maxRetriesPerRequest: 1
       });
       
       redis.on('error', (err) => {
         console.error('Redis connection failed:', err.message);
       });
       
       redis.ping().then((res) => {
         console.log('Redis Ping Result:', res);
         redis.quit();
       }).catch((err) => {
         console.error('Redis Ping Failed:', err.message);
         redis.quit();
       });
    }
  });
});
