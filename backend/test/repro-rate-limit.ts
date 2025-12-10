
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

async function run() {
  const fastify = Fastify();
  const redis = new Redis('redis://localhost:6379');
  
  await fastify.register(rateLimit, {
    global: false,
    max: 2,
    timeWindow: '1 minute',
    redis: redis,
    keyGenerator: (req) => {
      console.log('REPRO: keyGenerator called');
      return req.ip;
    }
  });

  fastify.get('/', {
    config: {
      rateLimit: {
        max: 2,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    return { hello: 'world' };
  });

  await fastify.ready();

  console.log('Making request 1...');
  const res1 = await fastify.inject({ method: 'GET', url: '/' });
  console.log('Res 1:', res1.statusCode, res1.headers['x-ratelimit-limit'], res1.headers['x-ratelimit-remaining']);

  console.log('Making request 2...');
  const res2 = await fastify.inject({ method: 'GET', url: '/' });
  console.log('Res 2:', res2.statusCode, res2.headers['x-ratelimit-limit'], res2.headers['x-ratelimit-remaining']);

  console.log('Making request 3...');
  const res3 = await fastify.inject({ method: 'GET', url: '/' });
  console.log('Res 3:', res3.statusCode);
  
  await redis.quit();
}

run();
