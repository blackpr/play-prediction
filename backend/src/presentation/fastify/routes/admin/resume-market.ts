import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Route params schema
const resumeMarketParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function resumeMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = resumeMarketParamsSchema.safeParse(request.params);
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
    const { resumeMarketUseCase } = request.diScope.cradle as AppCradle;
    const adminId = (request.user as any).id;

    const result = await resumeMarketUseCase.execute(id, adminId);

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
    request.log.error(error, 'Error resuming market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while resuming the market',
      },
    });
  }
}
