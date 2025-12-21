import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

const getPriceHistoryParamsSchema = z.object({
  id: z.string().uuid(),
});

const getPriceHistoryQuerySchema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function getPriceHistory(request: FastifyRequest, reply: FastifyReply) {
  const { id } = getPriceHistoryParamsSchema.parse(request.params);
  const { interval, from, to } = getPriceHistoryQuerySchema.parse(request.query);
  const { getMarketPriceHistoryUseCase } = request.diScope.cradle as AppCradle;

  // Defaults
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const candles = await getMarketPriceHistoryUseCase.execute({
    marketId: id,
    interval,
    from: fromDate,
    to: toDate
  });

  return reply.send({
    success: true,
    data: {
      marketId: id,
      interval,
      candles,
    },
  });
}
