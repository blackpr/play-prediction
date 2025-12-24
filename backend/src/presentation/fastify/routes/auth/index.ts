import { FastifyInstance } from 'fastify';
import { registerRoute } from './register';
import { loginRoute } from './login';
import { logoutRoute } from './logout';
import { meRoute } from './me';
import { callbackRoute } from './callback';
import { forgotPasswordRoute } from './forgot-password';
import { resetPasswordRoute } from './reset-password';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.register(registerRoute);
  fastify.register(loginRoute);
  fastify.register(logoutRoute);
  fastify.register(meRoute);
  fastify.register(callbackRoute);
  fastify.register(forgotPasswordRoute);
  fastify.register(resetPasswordRoute);
}
