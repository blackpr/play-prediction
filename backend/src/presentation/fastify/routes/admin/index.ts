import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/auth';
import { createMarket } from './create-market';
import { activateMarket } from './activate-market';
import { pauseMarket } from './pause-market';
import { resumeMarket } from './resume-market';
import { getAdminStats } from './get-stats';
import { listAdminMarkets } from './list-markets';
import { uploadRoutes } from './upload';
import { resolveMarket } from './resolve-market';

export default async function adminRoutes(server: FastifyInstance) {
  // Apply admin middleware to all routes in this module
  server.addHook('onRequest', requireAdmin);

  // POST /admin/markets - Create new market
  server.post('/markets', createMarket);

  // GET /admin/markets - List all markets for admin
  server.get('/markets', listAdminMarkets);

  // POST /admin/markets/:id/activate - Activate draft market
  server.post('/markets/:id/activate', activateMarket);

  // POST /admin/markets/:id/pause - Pause active market
  server.post('/markets/:id/pause', pauseMarket);

  // POST /admin/markets/:id/resume - Resume paused market
  server.post('/markets/:id/resume', resumeMarket);

  // POST /admin/markets/:id/resolve - Resolve market and pay winners
  server.post('/markets/:id/resolve', resolveMarket);

  // GET /admin/stats - Get admin dashboard stats
  server.get('/stats', getAdminStats);

  // File Uploads
  server.register(uploadRoutes);
}
