import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Query params schema
const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['user', 'admin', 'treasury']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function listUsers(request: FastifyRequest, reply: FastifyReply) {
  // Validate query params
  const queryResult = listUsersQuerySchema.safeParse(request.query);
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

  const { search, role, page, pageSize } = queryResult.data;

  try {
    const { listUsersUseCase } = request.diScope.cradle as AppCradle;

    const result = await listUsersUseCase.execute({
      search,
      role,
      page,
      pageSize,
    });

    return reply.status(200).send({
      success: true,
      data: {
        items: result.items.map((user: { id: string; email: string; role: string; balance: bigint; isActive: boolean; createdAt: Date }) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          balance: user.balance.toString(),
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
        })),
        pagination: result.pagination,
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
    request.log.error(error, 'Error listing users');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while listing users',
      },
    });
  }
}
