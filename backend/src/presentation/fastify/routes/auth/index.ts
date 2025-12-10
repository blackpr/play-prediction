import { FastifyInstance } from 'fastify';
import { registerRoute } from './register';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.register(registerRoute, { prefix: '/v1/auth' });
}
