import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Request Body Schema
const createMarketBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url().max(2048).optional(),
  closesAt: z.string().datetime(),
  seedLiquidity: z.string().regex(/^\d+$/, 'Seed liquidity must be a positive integer string'),
  closeBehavior: z.enum(['auto', 'manual', 'auto_with_buffer']).optional(),
  bufferMinutes: z.number().int().positive().optional(),
});

export async function createMarket(request: FastifyRequest, reply: FastifyReply) {
  // Validate body
  const bodyResult = createMarketBodySchema.safeParse(request.body);
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

  const { title, description, category, imageUrl, closesAt, seedLiquidity, closeBehavior, bufferMinutes } = bodyResult.data;

  try {
    const { createMarketUseCase } = request.diScope.cradle as AppCradle;

    const result = await createMarketUseCase.execute({
      title,
      description,
      category,
      imageUrl,
      closesAt: new Date(closesAt),
      seedLiquidity: BigInt(seedLiquidity),
      closeBehavior,
      bufferMinutes,
      createdBy: (request as any).user.id,
    });

    return reply.status(201).send({
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
    request.log.error(error, 'Error creating market');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating the market',
      },
    });
  }
}
