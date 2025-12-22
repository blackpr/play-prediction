import { FastifyRequest, FastifyReply } from 'fastify';
import { AppCradle } from '../../../../shared/container/types';

export async function getAdminStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { getAdminStatsUseCase } = request.diScope.cradle as AppCradle;

    const stats = await getAdminStatsUseCase.execute();
    return reply.send({
      success: true,
      data: stats
    });
  } catch (error) {
    request.log.error(error, 'Error fetching admin stats');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching admin stats',
      },
    });
  }
}
