import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function publicCategoryRoutes(server: FastifyInstance) {
  // GET /v1/categories - List all active categories
  server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { listCategoriesUseCase } = request.diScope.cradle;
    const categories = await listCategoriesUseCase.execute(false); // Only active
    return { success: true, data: categories };
  });
}
