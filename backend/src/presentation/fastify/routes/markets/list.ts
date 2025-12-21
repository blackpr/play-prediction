import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Query Params Schema
const getMarketsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED', 'PAUSED', 'DRAFT', 'all']).optional().default('ACTIVE'),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'closesAt', 'volume']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

export async function listMarkets(request: FastifyRequest, reply: FastifyReply) {
  const query = getMarketsQuerySchema.parse(request.query);
  const { getMarketsUseCase } = request.diScope.cradle as AppCradle;

  const { items, total } = await getMarketsUseCase.execute({
    status: query.status === 'all' ? undefined : query.status,
    category: query.category === 'all' ? undefined : query.category,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    order: query.order,
    search: query.search,
  });

  const totalPages = Math.ceil(total / query.pageSize);

  return reply.send({
    success: true,
    data: {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    },
  });
}
