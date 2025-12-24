import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

// Query Params Schema - Reuses similar logic to public list but allows 'all' status explicitly
// and defaults to showing everything for admins if not filtered
const getAdminMarketsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED', 'PAUSED', 'DRAFT', 'all']).optional().default('all'),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'closesAt', 'volume']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

export async function listAdminMarkets(request: FastifyRequest, reply: FastifyReply) {
  const query = getAdminMarketsQuerySchema.parse(request.query);
  const { getAdminMarketsUseCase } = request.diScope.cradle as AppCradle;

  // The simplified use case interface handles undefined as "no filter" effectively,
  // but our Zod schema uses 'all' as a keyword, so we map it.
  const { items, total } = await getAdminMarketsUseCase.execute({
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
