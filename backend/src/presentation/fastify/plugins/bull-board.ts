import fp from 'fastify-plugin';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { queueService } from '../../../infrastructure/jobs/queue-service';

/**
 * Fastify plugin to setup BullMQ Dashboard
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
    // TODO: Add admin authentication check here when Auth system is implemented
    // hooks: { onRequest: [fastify.authenticate, fastify.requireAdmin] }
  });
});
