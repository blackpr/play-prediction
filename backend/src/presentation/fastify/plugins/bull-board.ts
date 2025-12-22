import fp from 'fastify-plugin';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { queueService } from '../../../infrastructure/jobs/queue-service';
import { requireAdmin } from '../middleware/auth';

/**
 * Fastify plugin to setup BullMQ Dashboard
 * Protected by requireAdmin middleware
 */
export const bullBoardPlugin = fp(async (fastify) => {
  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: queueService.getQueues().map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  serverAdapter.setBasePath('/admin/queues');

  fastify.register(serverAdapter.registerPlugin(), {
    prefix: '/admin/queues',
    logLevel: 'warn',
  });

  // Protect all /admin/queues routes with admin authentication
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/admin/queues')) {
      await requireAdmin(request, reply);
    }
  });
});
