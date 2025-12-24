import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { NewCategory } from '../../../../infrastructure/database/drizzle/schema';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  defaultCloseBehavior: z.enum(['auto', 'manual', 'auto_with_buffer']).default('auto'),
  defaultBufferMinutes: z.number().int().positive().nullable().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

export async function categoryRoutes(server: FastifyInstance) {
  // GET /admin/categories - List all categories
  server.get('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    const { listCategoriesUseCase } = request.diScope.cradle;
    const { includeInactive } = request.query as { includeInactive?: string };
    const categories = await listCategoriesUseCase.execute(includeInactive === 'true');
    return { success: true, data: categories };
  });

  // POST /admin/categories - Create new category
  server.post('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    const { createCategoryUseCase } = request.diScope.cradle;
    const data = createCategorySchema.parse(request.body);
    const category = await createCategoryUseCase.execute(data as NewCategory);
    return { success: true, data: category };
  });

  // PATCH /admin/categories/:id - Update category
  server.patch('/categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { updateCategoryUseCase } = request.diScope.cradle;
    const { id } = request.params as { id: string };
    const data = updateCategorySchema.parse(request.body);
    const category = await updateCategoryUseCase.execute(id, data);
    return { success: true, data: category };
  });

  // DELETE /admin/categories/:id - Delete category
  server.delete('/categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deleteCategoryUseCase } = request.diScope.cradle;
    const { id } = request.params as { id: string };
    await deleteCategoryUseCase.execute(id);
    return { success: true, message: 'Category deleted successfully' };
  });
}
