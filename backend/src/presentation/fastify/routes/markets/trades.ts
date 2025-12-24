import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

const getTradesParamsSchema = z.object({
  id: z.string().uuid(),
});

const getTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function getMarketTrades(request: FastifyRequest, reply: FastifyReply) {
  const { id } = getTradesParamsSchema.parse(request.params);
  const { limit } = getTradesQuerySchema.parse(request.query);
  const { getMarketTradesUseCase } = request.diScope.cradle as AppCradle;

  const trades = await getMarketTradesUseCase.execute(id, limit);

  return reply.send({
    success: true,
    data: trades,
  });
}
