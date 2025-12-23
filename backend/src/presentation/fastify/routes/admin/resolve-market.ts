import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Route params schema
const resolveMarketParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

// Request body schema
const resolveMarketBodySchema = z.object({
  resolution: z.enum(['YES', 'NO'], {
    errorMap: () => ({ message: 'Resolution must be either YES or NO' }),
  }),
  evidence: z.string().max(1000).optional(),
  eventEndedAt: z.string().datetime().optional(),
});

export async function resolveMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = resolveMarketParamsSchema.safeParse(request.params);
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
  const bodyResult = resolveMarketBodySchema.safeParse(request.body);
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
  const { resolution, evidence, eventEndedAt } = bodyResult.data;

  try {
    const { resolveMarketUseCase } = request.diScope.cradle as AppCradle;

    const result = await resolveMarketUseCase.execute({
      marketId: id,
      resolution,
      evidence,
      eventEndedAt: eventEndedAt ? new Date(eventEndedAt) : undefined,
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
    request.log.error(error, 'Error resolving market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while resolving the market',
      },
    });
  }
}
