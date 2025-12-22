import { FastifyInstance } from 'fastify';
import { getPositionRoute } from './get-position';
import { getPortfolioRoute } from './get-portfolio';
import { getPortfolioHistoryRoute } from './get-history';

export async function portfolioRoutes(fastify: FastifyInstance) {
  fastify.register(getPositionRoute);
  fastify.register(getPortfolioRoute);
  fastify.register(getPortfolioHistoryRoute);
}
