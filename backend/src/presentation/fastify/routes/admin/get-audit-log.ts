import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '@/presentation/fastify/middleware/auth';
import { GetAuditLogUseCase } from '@/application/use-cases/admin/get-audit-log.use-case';
import { diContainer } from '@/shared/container';

const GetAuditLogSchema = z.object({
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(20),
  adminId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getAuditLogRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/audit-log',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
            adminId: { type: 'string' },
            action: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        adminId: { type: 'string' },
                        action: { type: 'string' },
                        entityType: { type: 'string', nullable: true },
                        entityId: { type: 'string', nullable: true },
                        details: { type: 'string', nullable: true },
                        createdAt: { type: 'string' },
                        adminEmail: { type: 'string' },
                      },
                    },
                  },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = GetAuditLogSchema.parse(request.query);
      const useCase = request.diScope.resolve<GetAuditLogUseCase>('getAuditLogUseCase');

      const result = await useCase.execute(query);

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
};
