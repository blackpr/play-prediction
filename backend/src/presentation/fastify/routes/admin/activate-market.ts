import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Route params schema
const activateMarketParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function activateMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = activateMarketParamsSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid market ID',
        details: paramsResult.error.errors,
      },
    });
  }

  const { id } = paramsResult.data;

  try {
    const { activateMarketUseCase } = request.diScope.cradle as AppCradle;

    const result = await activateMarketUseCase.execute(id);

    return reply.status(200).send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // Handle domain errors
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // Handle other errors
    request.log.error(error, 'Error activating market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while activating the market',
      },
    });
  }
}
