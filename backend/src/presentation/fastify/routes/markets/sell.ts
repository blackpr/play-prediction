import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';
import { BusinessLogicError } from '../../../../domain/errors/domain-error';

// Request Body Schema
const sellSharesBodySchema = z.object({
  side: z.enum(['YES', 'NO']),
  shares: z.string().regex(/^\d+$/, 'Shares must be a positive integer string'),
  minAmountOut: z.string().regex(/^\d+$/, 'MinAmountOut must be a positive integer string'),
  idempotencyKey: z.string().optional(),
});

// Params Schema
const sellSharesParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function sellShares(request: FastifyRequest, reply: FastifyReply) {
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
  const paramsResult = sellSharesParamsSchema.safeParse(request.params);
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
  const bodyResult = sellSharesBodySchema.safeParse(request.body);
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
  const { side, shares, minAmountOut, idempotencyKey } = bodyResult.data;

  try {
    const { sellSharesUseCase } = request.diScope.cradle as AppCradle;

    const result = await sellSharesUseCase.execute({
      userId: user.id,
      marketId,
      side,
      shares: BigInt(shares),
      minAmountOut: BigInt(minAmountOut),
      idempotencyKey,
    });

    return reply.status(200).send({
      success: true,
      data: {
        transactionId: result.transactionId,
        action: 'SELL',
        side,
        sharesIn: shares,
        amountOut: result.amountOut.toString(),
        feePaid: result.feePaid.toString(),
        feeBreakdown: {
          vault: result.feeVault.toString(),
          liquidity: result.feeLp.toString(),
        },
        avgExecutionPrice: result.avgExecutionPrice,
        newBalance: result.newBalance.toString(),
        pool: {
          yesQty: result.poolYesAfter.toString(),
          noQty: result.poolNoAfter.toString(),
        },
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
    request.log.error(error, 'Error executing sell order');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your request',
      },
    });
  }
}
