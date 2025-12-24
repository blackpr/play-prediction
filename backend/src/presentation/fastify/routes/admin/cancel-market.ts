import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Route params schema
const cancelMarketParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

// Request body schema
const cancelMarketBodySchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason must be at most 1000 characters'),
});

export async function cancelMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = cancelMarketParamsSchema.safeParse(request.params);
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
  const bodyResult = cancelMarketBodySchema.safeParse(request.body);
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
    const { cancelMarketUseCase } = request.diScope.cradle as AppCradle;
    const adminId = (request.user as any).id;

    const result = await cancelMarketUseCase.execute({
      marketId: id,
      reason,
      adminId,
    });

    return reply.status(200).send({
      success: true,
      data: {
        id: result.id,
        status: result.status,
        resolution: result.resolution,
        refunds: {
          totalHolders: result.totalHolders,
          totalRefunded: result.totalRefunded,
          surplus: result.surplus,
        },
      },
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
    request.log.error(error, 'Error cancelling market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while cancelling the market',
      },
    });
  }
}
