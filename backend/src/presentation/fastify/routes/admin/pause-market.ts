import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Route params schema
const pauseMarketParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

// Request body schema
const pauseMarketBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function pauseMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = pauseMarketParamsSchema.safeParse(request.params);
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

  // Validate body
  const bodyResult = pauseMarketBodySchema.safeParse(request.body);
  if (!bodyResult.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body',
        details: bodyResult.error.errors,
      },
    });
  }

  const { id } = paramsResult.data;
  const { reason } = bodyResult.data;

  try {
    const { pauseMarketUseCase } = request.diScope.cradle as AppCradle;

    const result = await pauseMarketUseCase.execute({ marketId: id, reason });

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
    request.log.error(error, 'Error pausing market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while pausing the market',
      },
    });
  }
}
