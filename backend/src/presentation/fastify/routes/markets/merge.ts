import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';
import { BusinessLogicError } from '../../../../domain/errors/domain-error';

// Request Body Schema
const mergeSharesBodySchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
});

// Params Schema
const mergeSharesParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function mergeShares(request: FastifyRequest, reply: FastifyReply) {
  // Require authentication
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

  // Validate params
  const paramsResult = mergeSharesParamsSchema.safeParse(request.params);
  if (!paramsResult.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message: 'Invalid market ID',
        details: paramsResult.error.errors,
      },
    });
  }

  // Validate body
  const bodyResult = mergeSharesBodySchema.safeParse(request.body);
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

  const { id: marketId } = paramsResult.data;
  const { amount } = bodyResult.data;

  try {
    const { mergeSharesUseCase } = request.diScope.cradle as AppCradle;

    const result = await mergeSharesUseCase.execute({
      userId: user.id,
      marketId,
      amount: BigInt(amount),
    });

    return reply.status(200).send({
      success: true,
      data: {
        amountOut: result.amountOut.toString(),
        newBalance: result.newBalance.toString(),
      },
    });
  } catch (error: any) {
    // Handle business logic errors
    if (error instanceof BusinessLogicError) {
      // INSUFFICIENT_SHARES might be 400
      const statusCode = error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'OPTIMISTIC_LOCK_FAIL' ? 409 : 400;

      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // Handle other errors
    request.log.error(error, 'Error executing merge order');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your request',
      },
    });
  }
}
