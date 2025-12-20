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
  fastify.get('/me/points-history', {
    preHandler: [requireAuth],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const getPointsHistoryUseCase = request.diScope.resolve('getPointsHistoryUseCase');
      const { page, pageSize } = request.query as { page: number; pageSize: number };

      const { items, total } = await getPointsHistoryUseCase.execute({
        userId: request.user!.id,
        page,
        pageSize,
      });

      return reply.status(200).send({
        success: true,
        data: {
          items: items.map(item => ({
            id: item.id,
            type: item.grantType,
            amount: item.amount.toString(),
            balanceAfter: item.balanceAfter.toString(),
            grantedBy: item.grantedByEmail ?? null,
            reason: item.reason,
            createdAt: item.createdAt.toISOString(),
          })),
          pagination: {
            page,
            pageSize,
            totalItems: total,
          }
        }
      });
    } catch (error) {
      request.log.error(error, 'Failed to fetch points history');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch points history',
        }
      });
    }
  });
}

