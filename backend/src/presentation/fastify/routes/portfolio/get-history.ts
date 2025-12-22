import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const querySchema = z.object({
  marketId: z.string().uuid().optional(),
  action: z.enum(['BUY', 'SELL', 'MINT', 'MERGE']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  pageSize: z.string().regex(/^\d+$/).transform(Number).default('20'),
});

export async function getPortfolioHistoryRoute(fastify: FastifyInstance) {
  fastify.get('/history', async (request, reply) => {
    // Check authentication
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const queryResult = querySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Invalid query parameters',
          details: queryResult.error.errors,
        },
      });
    }

    const { marketId, action, page, pageSize } = queryResult.data;
    const userId = user.id;

    try {
      const getPortfolioHistoryUseCase = request.diScope.resolve('getPortfolioHistoryUseCase');
      const result = await getPortfolioHistoryUseCase.execute({
        userId,
        marketId,
        action,
        page,
        pageSize
      });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch portfolio history',
        },
      });
    }
  });
}
