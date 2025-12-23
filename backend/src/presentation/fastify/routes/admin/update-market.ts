import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Request Params Schema
const updateMarketParamsSchema = z.object({
  id: z.string().uuid(),
});

// Request Body Schema
const updateMarketBodySchema = z.object({
  title: z.string().min(10).max(500).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().url().max(2048).optional(),
  closesAt: z.string().datetime().optional(),
  seedLiquidity: z.union([z.string(), z.number()]).transform((val) => BigInt(val)).optional(),
  initialYesPrice: z.number().min(0.01).max(0.99).optional(),
  closeBehavior: z.enum(['auto', 'manual', 'auto_with_buffer']).optional(),
  bufferMinutes: z.number().int().positive().nullable().optional(),
});

export async function updateMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate params
  const paramsResult = updateMarketParamsSchema.safeParse(request.params);
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
  const bodyResult = updateMarketBodySchema.safeParse(request.body);
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
  const updates = bodyResult.data;

  // Check if at least one field is provided
  if (Object.keys(updates).length === 0) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'At least one field must be provided for update',
      },
    });
  }

  try {
    const { updateMarketUseCase } = request.diScope.cradle as AppCradle;

    const result = await updateMarketUseCase.execute({
      marketId: id,
      adminId: (request as any).user.id,
      title: updates.title,
      description: updates.description,
      categoryId: updates.categoryId,
      imageUrl: updates.imageUrl,
      closesAt: updates.closesAt ? new Date(updates.closesAt) : undefined,
      seedLiquidity: updates.seedLiquidity,
      initialYesPrice: updates.initialYesPrice,
      closeBehavior: updates.closeBehavior,
      bufferMinutes: updates.bufferMinutes,
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
    request.log.error(error, 'Error updating market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating the market',
      },
    });
  }
}
