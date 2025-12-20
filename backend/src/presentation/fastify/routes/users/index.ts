import { FastifyInstance } from 'fastify';
import { meRoute } from './me';
// Add future user routes here (e.g., points history)

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.register(meRoute, { prefix: '/v1/users' });
}
