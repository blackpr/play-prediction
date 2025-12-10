import { FastifyInstance } from 'fastify';
import { registerRoute } from './register';
import { loginRoute } from './login';
import { logoutRoute } from './logout';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.register(registerRoute, { prefix: '/v1/auth' });
  fastify.register(loginRoute, { prefix: '/v1/auth' });
  fastify.register(logoutRoute, { prefix: '/v1/auth' });
}
