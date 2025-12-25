import { FastifyRequest, FastifyReply } from 'fastify';
import { diContainer } from '../../../../shared/container';

export async function notifyDeployment(
  request: FastifyRequest<{ Body: { version: string } }>,
  reply: FastifyReply
) {
  const webSocketManager = diContainer.resolve('webSocketManager');

  // Default to timestamp if no version provided
  const version = request.body?.version || new Date().toISOString();

  await webSocketManager.broadcastDeployment(version);

  return reply.status(200).send({
    success: true,
    data: {
      message: 'Deployment notification sent',
      version
    }
  });
}
