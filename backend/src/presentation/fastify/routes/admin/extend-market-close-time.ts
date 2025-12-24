import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Route params schema
const extendMarketCloseTimeParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

// Request body schema
const extendMarketCloseTimeBodySchema = z.object({
  newClosesAt: z.string().datetime({ message: 'Invalid datetime format. Use ISO 8601 format (e.g., 2024-12-25T23:59:59Z)' }),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be 500 characters or less'),
});

export async function extendMarketCloseTime(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = extendMarketCloseTimeParamsSchema.safeParse(request.params);
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
  const bodyResult = extendMarketCloseTimeBodySchema.safeParse(request.body);
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
  const { newClosesAt, reason } = bodyResult.data;

  try {
    const { extendMarketCloseTimeUseCase } = request.diScope.cradle as AppCradle;
    const adminId = (request.user as any).id;

    const result = await extendMarketCloseTimeUseCase.execute({
      marketId: id,
      newClosesAt,
      reason,
      adminId,
    });

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
    request.log.error(error, 'Error extending market close time');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while extending the market close time',
      },
    });
  }
}
