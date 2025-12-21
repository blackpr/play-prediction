import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppCradle } from '../../../../shared/container/types';

const getMarketParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function getMarket(request: FastifyRequest, reply: FastifyReply) {
  const { id } = getMarketParamsSchema.parse(request.params);
  const { getMarketUseCase } = request.diScope.cradle as AppCradle;

  const market = await getMarketUseCase.execute(id);

  return reply.send({
    success: true,
    data: market,
  });
}
