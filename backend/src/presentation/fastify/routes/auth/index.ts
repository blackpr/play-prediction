import { FastifyInstance } from 'fastify';
import { registerRoute } from './register';
import { loginRoute } from './login';
import { logoutRoute } from './logout';
import { meRoute } from './me';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.register(registerRoute, { prefix: '/v1/auth' });
  fastify.register(loginRoute, { prefix: '/v1/auth' });
  fastify.register(logoutRoute, { prefix: '/v1/auth' });
  fastify.register(meRoute, { prefix: '/v1/auth' });
}
