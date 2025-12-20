import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/auth';
import { NotFoundError } from '../../../../domain/errors/domain-error';

export async function meRoute(fastify: FastifyInstance) {
  fastify.get('/me', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const meUseCase = request.diScope.resolve('meUseCase');
      // request.user is guaranteed to be present due to requireAuth
      const user = await meUseCase.execute(request.user!.id);

      return reply.status(200).send({
        success: true,
        data: {
          ...user,
          // Convert BigInt to string for JSON serialization
          balance: user.balance.toString(),
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found',
          }
        });
      }

      request.log.error(error, 'Failed to fetch user profile');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user profile',
        }
      });
    }
  });
}
