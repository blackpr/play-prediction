import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UploadMarketImageUseCase } from '../../../../application/use-cases/admin/upload-market-image';
import { requireAdmin } from '../../middleware/auth';
import { createAdminClient } from '../../../../infrastructure/auth/supabase';

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/upload/image', {
    onRequest: [requireAdmin],
    schema: {
      tags: ['Admin'],
      description: 'Upload an image for a market',
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                url: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Use Admin Client (Service Role) to bypass RLS for storage uploads
    const supabase = createAdminClient();
    const useCase = new UploadMarketImageUseCase(supabase);

    const file = await request.file();

    if (!file) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FILE_MISSING',
          message: 'No file uploaded'
        }
      });
    }

    try {
      const result = await useCase.execute({ file });
      return reply.status(200).send({
        success: true,
        data: result
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(error.statusCode || 500).send({
        success: false,
        error: {
          code: error.code || 'INTERNAL_SERVER_ERROR',
          message: error.message,
          details: error.details
        }
      });
    }
  });
}
