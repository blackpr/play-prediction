import { FastifyInstance } from 'fastify';
import { listMarkets } from './list';
import { getMarket } from './get';
import { getPriceHistory } from './price-history';
import { getMarketTrades } from './trades';
import { buyShares } from './buy';
import { sellShares } from './sell';

export async function marketsRoutes(fastify: FastifyInstance) {
  fastify.get('/', listMarkets);
  fastify.get('/:id', getMarket);
  fastify.get('/:id/price-history', getPriceHistory);
  fastify.get('/:id/trades', getMarketTrades);
  fastify.post('/:id/buy', buyShares);
  fastify.post('/:id/sell', sellShares);
}
