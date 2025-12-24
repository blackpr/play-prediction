import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';
import { NotFoundError } from '../../../../domain/errors/domain-error';

// Query Parameters Schema
const quoteQuerySchema = z.object({
  side: z.enum(['YES', 'NO']),
  action: z.enum(['BUY', 'SELL']),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
});

// Params Schema
const quoteParamsSchema = z.object({
  id: z.string().uuid('Invalid market ID format'),
});

export async function getQuote(request: FastifyRequest, reply: FastifyReply) {
  // Public endpoint - no authentication required

  // Validate params
  const paramsResult = quoteParamsSchema.safeParse(request.params);
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

  // Validate query parameters
  const queryResult = quoteQuerySchema.safeParse(request.query);
  if (!queryResult.success) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      },
    });
  }

  const { id: marketId } = paramsResult.data;
  const { side, action, amount } = queryResult.data;

  try {
    const { getQuoteUseCase } = request.diScope.cradle as AppCradle;

    const result = await getQuoteUseCase.execute({
      marketId,
      side,
      action,
      amount: BigInt(amount),
    });

    return reply.status(200).send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // Handle not found errors
    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'MARKET_NOT_FOUND',
          message: error.message,
        },
      });
    }

    // Handle other errors
    request.log.error(error, 'Error getting quote');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing your request',
      },
    });
  }
}
