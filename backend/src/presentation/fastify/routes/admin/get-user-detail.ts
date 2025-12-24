import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Params schema
const getUserDetailParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

export async function getUserDetail(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = getUserDetailParamsSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid user ID',
        details: paramsResult.error.errors,
      },
    });
  }

  const { id: userId } = paramsResult.data;

  try {
    const { getUserDetailUseCase } = request.diScope.cradle as AppCradle;

    const result = await getUserDetailUseCase.execute({ userId });

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
    request.log.error(error, 'Error getting user detail');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving user details',
      },
    });
  }
}
