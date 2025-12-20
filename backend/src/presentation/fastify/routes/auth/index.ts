import { FastifyInstance } from 'fastify';
import { registerRoute } from './register';
import { loginRoute } from './login';
import { logoutRoute } from './logout';
import { meRoute } from './me';
import { callbackRoute } from './callback';
import { forgotPasswordRoute } from './forgot-password';
import { resetPasswordRoute } from './reset-password';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.register(registerRoute, { prefix: '/v1/auth' });
  fastify.register(loginRoute, { prefix: '/v1/auth' });
  fastify.register(logoutRoute, { prefix: '/v1/auth' });
  fastify.register(meRoute, { prefix: '/v1/auth' });
  fastify.register(callbackRoute, { prefix: '/v1/auth' });
  fastify.register(forgotPasswordRoute, { prefix: '/v1/auth' });
  fastify.register(resetPasswordRoute, { prefix: '/v1/auth' });
}
