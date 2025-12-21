import { FastifyInstance } from 'fastify';
import { listMarkets } from './list';

export async function marketsRoutes(fastify: FastifyInstance) {
  fastify.get('/', listMarkets);
}
