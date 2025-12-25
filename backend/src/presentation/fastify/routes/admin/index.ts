import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/auth';
import { createMarket } from './create-market';
import { updateMarket } from './update-market';
import { activateMarket } from './activate-market';
import { pauseMarket } from './pause-market';
import { resumeMarket } from './resume-market';
import { extendMarketCloseTime } from './extend-market-close-time';
import { getAdminStats } from './get-stats';
import { listAdminMarkets } from './list-markets';
import { uploadRoutes } from './upload';
import { resolveMarket } from './resolve-market';
import { cancelMarket } from './cancel-market';
import { grantPoints } from './grant-points';
import { listUsers } from './list-users';
import { getUserDetail } from './get-user-detail';
import { getAuditLogRoute } from './get-audit-log';
import { categoryRoutes } from './categories';
import { notifyDeployment } from './notify-deployment';

export default async function adminRoutes(server: FastifyInstance) {
  // Apply admin middleware to all routes in this module
  server.addHook('onRequest', requireAdmin);

  // POST /admin/markets - Create new market
  server.post('/markets', createMarket);

  // PATCH /admin/markets/:id - Update draft market
  server.patch('/markets/:id', updateMarket);

  // GET /admin/markets - List all markets for admin
  server.get('/markets', listAdminMarkets);

  // POST /admin/markets/:id/activate - Activate draft market
  server.post('/markets/:id/activate', activateMarket);

  // POST /admin/markets/:id/pause - Pause active market
  server.post('/markets/:id/pause', pauseMarket);

  // POST /admin/markets/:id/resume - Resume paused market
  server.post('/markets/:id/resume', resumeMarket);

  // PATCH /admin/markets/:id/extend - Extend market close time
  server.patch('/markets/:id/extend', extendMarketCloseTime);

  // POST /admin/markets/:id/resolve - Resolve market and pay winners
  server.post('/markets/:id/resolve', resolveMarket);

  // POST /admin/markets/:id/cancel - Cancel market and refund holders
  server.post('/markets/:id/cancel', cancelMarket);

  // GET /admin/users - List all users
  server.get('/users', listUsers);

  // GET /admin/users/:id - Get detailed user info with stats
  server.get('/users/:id', getUserDetail);

  // POST /admin/users/:id/grant-points - Grant points to user
  server.post('/users/:id/grant-points', grantPoints);

  // GET /admin/stats - Get admin dashboard stats
  server.get('/stats', getAdminStats);

  // File Uploads
  server.register(uploadRoutes);

  // Audit Logs
  server.register(getAuditLogRoute);

  // Categories
  server.register(categoryRoutes);

  // POST /admin/deploy/notify - Notify deployment
  server.post('/deploy/notify', notifyDeployment);
}

