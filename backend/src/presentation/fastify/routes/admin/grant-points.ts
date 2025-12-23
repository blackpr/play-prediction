import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';
import { BusinessLogger } from '../../../../shared/logger';

// Route params schema
const grantPointsParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

// Request body schema
const grantPointsBodySchema = z.object({
  amount: z.string()
    .refine((val) => {
      try {
        const num = BigInt(val);
        return num > 0n;
      } catch {
        return false;
      }
    }, 'Amount must be a positive integer'),
  reason: z.string()
    .min(1, 'Reason is required')
    .max(1000, 'Reason must be at most 1000 characters'),
});

export async function grantPoints(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = grantPointsParamsSchema.safeParse(request.params);
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

  // Validate body
  const bodyResult = grantPointsBodySchema.safeParse(request.body);
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
  const { amount, reason } = bodyResult.data;

  // Get admin user from request
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  try {
    const { grantPointsUseCase } = request.diScope.cradle as AppCradle;

    const result = await grantPointsUseCase.execute({
      userId: id,
      amount: BigInt(amount),
      reason,
      adminId: request.user.id,
    });

    // Log admin action
    BusinessLogger.logAdminAction(request.log, {
      adminId: request.user.id,
      adminEmail: request.user.email,
      action: 'POINTS_GRANTED',
      entityType: 'USER',
      entityId: id,
      details: {
        amount,
        reason,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        grantId: result.grantId,
        userId: result.userId,
        amount: result.amount,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        reason: result.reason,
        grantedBy: result.grantedBy,
        createdAt: result.createdAt,
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
    request.log.error(error, 'Error granting points');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while granting points',
      },
    });
  }
}
