import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';
import { BusinessLogicError } from '../../../../domain/errors/domain-error';

// Request Body Schema
const mintSharesBodySchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
});

// Params Schema
const mintSharesParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function mintShares(request: FastifyRequest, reply: FastifyReply) {
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
  const paramsResult = mintSharesParamsSchema.safeParse(request.params);
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
  const bodyResult = mintSharesBodySchema.safeParse(request.body);
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
    const { mintSharesUseCase } = request.diScope.cradle as AppCradle;

    const result = await mintSharesUseCase.execute({
      userId: user.id,
      marketId,
      amount: BigInt(amount),
    });

    return reply.status(200).send({
      success: true,
      data: {
        yesOut: result.yesOut.toString(),
        noOut: result.noOut.toString(),
        newBalance: result.newBalance.toString(),
      },
    });
  } catch (error: any) {
    // Handle business logic errors
    if (error instanceof BusinessLogicError) {
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
    request.log.error(error, 'Error executing mint order');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your request',
      },
    });
  }
}
