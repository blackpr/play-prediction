import { FastifyInstance } from 'fastify';
import { listMarkets } from './list';
import { getMarket } from './get';

export async function marketsRoutes(fastify: FastifyInstance) {
  fastify.get('/', listMarkets);
  fastify.get('/:id', getMarket);
}
