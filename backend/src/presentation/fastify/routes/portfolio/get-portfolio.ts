import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const paramsSchema = z.object({
  status: z.enum(['ACTIVE', 'RESOLVED', 'POTENTIAL']).optional(), // Changed to uppercase to match other enums, though spec said lowercase? Checking spec... Spec says status - filter by market status in query params. 
  hasPosition: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
});

export async function getPortfolioRoute(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
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

    const queryResult = paramsSchema.safeParse(request.query);
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

    const { status, hasPosition } = queryResult.data;
    const userId = user.id;

    try {
      const getPortfolioUseCase = request.diScope.resolve('getPortfolioUseCase');
      const result = await getPortfolioUseCase.execute({
        userId,
        status: status as any, // Cast to match backend type 
        hasPosition
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
          message: 'Failed to fetch portfolio',
        },
      });
    }
  });
}
