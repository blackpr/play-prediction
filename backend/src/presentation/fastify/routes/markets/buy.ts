import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';
import { BusinessLogicError } from '../../../../domain/errors/domain-error';

// Request Body Schema
const buySharesBodySchema = z.object({
  side: z.enum(['YES', 'NO']),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
  minSharesOut: z.string().regex(/^\d+$/, 'MinSharesOut must be a positive integer string'),
  idempotencyKey: z.string().optional(),
});

// Params Schema
const buySharesParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function buyShares(request: FastifyRequest, reply: FastifyReply) {
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
  const paramsResult = buySharesParamsSchema.safeParse(request.params);
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
  const bodyResult = buySharesBodySchema.safeParse(request.body);
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
  const { side, amount, minSharesOut, idempotencyKey } = bodyResult.data;

  try {
    const { buySharesUseCase } = request.diScope.cradle as AppCradle;

    const result = await buySharesUseCase.execute({
      userId: user.id,
      marketId,
      side,
      amount: BigInt(amount),
      minSharesOut: BigInt(minSharesOut),
      idempotencyKey,
    });

    return reply.status(200).send({
      success: true,
      data: {
        transactionId: result.transactionId,
        action: 'BUY',
        side,
        amountIn: amount,
        sharesOut: result.sharesOut.toString(),
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
    request.log.error(error, 'Error executing buy order');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your request',
      },
    });
  }
}
