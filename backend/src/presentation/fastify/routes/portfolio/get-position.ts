import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const paramsSchema = z.object({
  marketId: z.string().uuid(),
});

export async function getPositionRoute(fastify: FastifyInstance) {
  fastify.get('/:marketId', async (request, reply) => {
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

    const { marketId } = paramsSchema.parse(request.params);
    const userId = user.id;

    try {
      const getPositionUseCase = request.diScope.resolve('getPositionUseCase');
      const result = await getPositionUseCase.execute({ userId, marketId });

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
          message: 'Failed to fetch position',
        },
      });
    }
  });
}
