import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/auth';
import { createMarket } from './create-market';

export default async function adminRoutes(server: FastifyInstance) {
  // Apply admin middleware to all routes in this module
  server.addHook('onRequest', requireAdmin);

  // POST /admin/markets - Create new market
  server.post('/markets', createMarket);
}
